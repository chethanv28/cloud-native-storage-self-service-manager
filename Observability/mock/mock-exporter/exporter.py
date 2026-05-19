#!/usr/bin/env python3
"""
exporter.py — Generic mock CSI driver Prometheus metrics exporter.

Always serves standard CSI sidecar metrics on port 9809:
    http://localhost:9809/metrics
        csi_sidecar_operations_seconds{driver_name, grpc_status_code, method_name}

When DRIVER=vsphere, also serves vSphere-specific metrics:
    http://localhost:2112/metrics   vsphere-csi-controller extras
    http://localhost:2113/metrics   vsphere-syncer extras

Environment variables:
    SCENARIO      normal | degraded | failing   (default: normal)
    DRIVER        generic | vsphere             (default: generic)
    DRIVER_NAME   CSI driver name label         (default: csi.example.com)

Usage:
    pip install -r requirements.txt
    python exporter.py                          # generic, normal scenario
    DRIVER=vsphere SCENARIO=degraded python exporter.py
"""

import os
import random
import threading
import time
from http.server import HTTPServer

from prometheus_client import CollectorRegistry, Gauge, Histogram, MetricsHandler

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SCENARIO    = os.environ.get("SCENARIO",    "normal").lower()
DRIVER      = os.environ.get("DRIVER",      "generic").lower()
DRIVER_NAME = os.environ.get("DRIVER_NAME", "csi.vsphere.vmware.com" if DRIVER == "vsphere" else "csi.example.com")

# gRPC status code weights per scenario — (code, probability)
_GRPC_WEIGHTS = {
    "normal":   [("OK", 0.985), ("Unknown", 0.008), ("Unavailable", 0.007)],
    "degraded": [("OK", 0.940), ("Unknown", 0.025), ("Unavailable", 0.020), ("PermissionDenied", 0.015)],
    "failing":  [("OK", 0.700), ("Unavailable", 0.120), ("Unknown", 0.100), ("Internal", 0.050), ("PermissionDenied", 0.030)],
}

# CSI gRPC method names (Controller service)
_METHODS = [
    "/csi.v1.Controller/CreateVolume",
    "/csi.v1.Controller/DeleteVolume",
    "/csi.v1.Controller/ControllerPublishVolume",    # attach
    "/csi.v1.Controller/ControllerUnpublishVolume",  # detach
    "/csi.v1.Controller/ValidateVolumeCapabilities",
    "/csi.v1.Controller/ListVolumes",
    "/csi.v1.Controller/CreateSnapshot",
    "/csi.v1.Controller/DeleteSnapshot",
    "/csi.v1.Controller/ListSnapshots",
    "/csi.v1.Controller/ControllerExpandVolume",
    "/csi.v1.Controller/ControllerModifyVolume",
]

# vSphere-specific operation types (maps loosely to CSI methods above)
_VSPHERE_CSI_OPTYPES = [
    "create-volume", "delete-volume", "attach-volume", "detach-volume",
    "expand-volume", "create-snapshot", "delete-snapshot",
    "list-volume", "list-snapshot",
]
_VSPHERE_CNS_OPTYPES = [
    "create-volume", "delete-volume", "attach-volume", "detach-volume",
    "batch-volume", "update-volume-metadata", "expand-volume",
    "query-volume", "query-all-volume", "query-volume-info",
    "relocate-volume", "create-snapshot", "delete-snapshot",
    "query-snapshots", "unregister-volume",
]
_VSPHERE_VC_REQUESTS = [
    "QueryAllVolume", "QueryVolume", "CreateVolume", "DeleteVolume",
    "AttachVolume", "DetachVolume", "ExpandVolume",
    "QuerySnapshotVolume", "CreateSnapshot", "DeleteSnapshot",
]
_VSPHERE_FAULT_WEIGHTS = {
    "normal":   [("", 0.985), ("NotFound", 0.010), ("AlreadyExists", 0.005)],
    "degraded": [("", 0.940), ("NotFound", 0.030), ("Timeout", 0.020), ("vSAN-policy", 0.010)],
    "failing":  [("", 0.700), ("Timeout", 0.150), ("NotFound", 0.080), ("vSAN-policy", 0.050), ("NotAuthenticated", 0.020)],
}

# ---------------------------------------------------------------------------
# Registries
# ---------------------------------------------------------------------------

sidecar_reg = CollectorRegistry()   # port 9809 — standard, always active
vsphere_reg = CollectorRegistry()   # port 2112 — vSphere controller extras
syncer_reg  = CollectorRegistry()   # port 2113 — vSphere syncer extras

# ---------------------------------------------------------------------------
# Standard CSI sidecar metric (port 9809) — works for ANY CSI driver
# ---------------------------------------------------------------------------

csi_sidecar_ops = Histogram(
    "csi_sidecar_operations_seconds",
    "Container Storage Interface operation duration with gRPC error code status",
    ["driver_name", "grpc_status_code", "method_name"],
    buckets=[0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15, 30, 60, 120, 300, 600],
    registry=sidecar_reg,
)

# ---------------------------------------------------------------------------
# vSphere-specific metrics (ports 2112 + 2113) — only when DRIVER=vsphere
# ---------------------------------------------------------------------------

if DRIVER == "vsphere":
    vsphere_csi_info = Gauge(
        "vsphere_csi_info", "CSI Info", ["version"], registry=vsphere_reg,
    )
    vsphere_csi_ops = Histogram(
        "vsphere_csi_volume_ops_histogram",
        "Histogram vector for CSI volume operations.",
        ["voltype", "optype", "status", "faulttype"],
        buckets=[2, 5, 10, 15, 20, 25, 30, 60, 120, 180],
        registry=vsphere_reg,
    )
    vsphere_cns_ops = Histogram(
        "vsphere_cns_volume_ops_histogram",
        "Histogram vector for CNS operations.",
        ["optype", "status"],
        buckets=[2, 5, 10, 15, 20, 25, 30, 60, 120, 180],
        registry=vsphere_reg,
    )
    vsphere_vc_req = Histogram(
        "vsphere_request_ops_seconds",
        "Histogram vector for individual request to vCenter",
        ["request", "client", "status"],
        buckets=[2, 5, 10, 15, 20, 25, 30, 60, 120, 180],
        registry=vsphere_reg,
    )
    vsphere_vol_health = Gauge(
        "vsphere_volume_health_gauge",
        "Gauge for total number of accessible and inaccessible volumes",
        ["volume_health_type"],
        registry=vsphere_reg,
    )
    vsphere_syncer_info = Gauge(
        "vsphere_syncer_info", "Syncer Info", ["version"], registry=syncer_reg,
    )
    vsphere_full_sync = Histogram(
        "vsphere_full_sync_ops_histogram",
        "Histogram vector for CSI Full Sync operations.",
        ["status"],
        buckets=[2, 5, 10, 15, 20, 25, 30, 60, 120, 180],
        registry=syncer_reg,
    )
    vsphere_pv_missing = Gauge(
        "vsphere_cns_volume_pv_missing",
        "Number of CNS volumes whose corresponding Kubernetes PV was not found",
        ["vc"],
        registry=syncer_reg,
    )
    vsphere_csi_info.labels(version="v3.3.1").set(1)
    vsphere_syncer_info.labels(version="v3.3.1").set(1)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sample_latency(lo, hi):
    base = random.uniform(lo, hi)
    if SCENARIO == "degraded": base *= random.uniform(1.5, 3.0)
    elif SCENARIO == "failing": base *= random.uniform(4.0, 10.0)
    return max(0.05, base)

def _grpc_outcome():
    weights = _GRPC_WEIGHTS.get(SCENARIO, _GRPC_WEIGHTS["normal"])
    codes = [w[0] for w in weights]
    probs = [w[1] for w in weights]
    return random.choices(codes, weights=probs)[0]

def _vsphere_outcome():
    weights = _VSPHERE_FAULT_WEIGHTS.get(SCENARIO, _VSPHERE_FAULT_WEIGHTS["normal"])
    faults = [w[0] for w in weights]
    probs  = [w[1] for w in weights]
    fault  = random.choices(faults, weights=probs)[0]
    return ("pass" if fault == "" else "fail"), fault

# ---------------------------------------------------------------------------
# Metric generation loop
# ---------------------------------------------------------------------------

def _generate():
    tick = 0
    while True:
        tick += 1

        # ── Standard CSI sidecar metrics (always) ────────────────────────
        for method in _METHODS:
            for _ in range(random.randint(1, 3)):
                code = _grpc_outcome()
                lat  = _sample_latency(0.5, 8.0)
                csi_sidecar_ops.labels(
                    driver_name=DRIVER_NAME,
                    grpc_status_code=code,
                    method_name=method,
                ).observe(lat)

        # ── vSphere-specific extras ───────────────────────────────────────
        if DRIVER == "vsphere":
            for optype in _VSPHERE_CSI_OPTYPES:
                for _ in range(random.randint(1, 3)):
                    voltype = random.choice(["block", "file"])
                    status, fault = _vsphere_outcome()
                    vsphere_csi_ops.labels(
                        voltype=voltype, optype=optype,
                        status=status, faulttype=fault,
                    ).observe(_sample_latency(1.5, 8.0))

            for optype in _VSPHERE_CNS_OPTYPES:
                status, _ = _vsphere_outcome()
                vsphere_cns_ops.labels(optype=optype, status=status).observe(
                    _sample_latency(0.3, 4.0)
                )

            for req in _VSPHERE_VC_REQUESTS:
                status, _ = _vsphere_outcome()
                vsphere_vc_req.labels(
                    request=req, client="csi-controller", status=status
                ).observe(_sample_latency(0.1, 2.5))

            if SCENARIO == "normal":
                accessible, inaccessible = random.randint(95, 130), 0
            elif SCENARIO == "degraded":
                accessible  = random.randint(80, 120)
                inaccessible = random.randint(1, 4)
            else:
                accessible  = random.randint(40, 90)
                inaccessible = random.randint(6, 25)

            vsphere_vol_health.labels(volume_health_type="accessible-volumes").set(accessible)
            vsphere_vol_health.labels(volume_health_type="inaccessible-volumes").set(inaccessible)

            if tick % 30 == 0:
                sync_status = (
                    "pass" if SCENARIO == "normal"
                    else random.choices(["pass", "fail"], weights=[0.7, 0.3])[0]
                )
                vsphere_full_sync.labels(status=sync_status).observe(
                    _sample_latency(4.0, 20.0)
                )

            missing = (
                0 if SCENARIO == "normal"
                else random.randint(1, 3) if SCENARIO == "degraded"
                else random.randint(4, 12)
            )
            vsphere_pv_missing.labels(vc="vcenter-01.lab.local").set(missing)

        time.sleep(2)

# ---------------------------------------------------------------------------
# HTTP servers
# ---------------------------------------------------------------------------

class _Server:
    def __init__(self, port, registry):
        handler = MetricsHandler.factory(registry)
        self._httpd = HTTPServer(("", port), handler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)

    def start(self):
        self._thread.start()

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"CSI mock exporter  driver={DRIVER!r}  scenario={SCENARIO!r}  driver_name={DRIVER_NAME!r}")
    print(f"  Standard sidecar metrics → http://localhost:9809/metrics")

    _Server(9809, sidecar_reg).start()

    if DRIVER == "vsphere":
        print(f"  vSphere controller       → http://localhost:2112/metrics")
        print(f"  vSphere syncer           → http://localhost:2113/metrics")
        _Server(2112, vsphere_reg).start()
        _Server(2113, syncer_reg).start()

    threading.Thread(target=_generate, daemon=True).start()

    print("Ready — press Ctrl-C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopped.")
