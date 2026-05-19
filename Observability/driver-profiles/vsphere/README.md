# Driver Profile: vSphere CSI Driver

Extends the base `csi-driver-observability` stack with the additional Prometheus
metrics exposed by the [vSphere CSI driver](https://github.com/kubernetes-sigs/vsphere-csi-driver)
on top of the standard `csi_sidecar_operations_seconds` metric.

## What the vSphere driver adds

The vSphere CSI driver exposes two additional metrics endpoints beyond the
standard CSI sidecars:

| Port | Container | Extra metric families |
|------|-----------|----------------------|
| **2112** | `vsphere-csi-controller` | `vsphere_csi_volume_ops_histogram` (labelled `voltype`, `optype`, `status`, `faulttype`), `vsphere_cns_volume_ops_histogram`, `vsphere_request_ops_seconds`, `vsphere_volume_health_gauge`, `vsphere_csi_info` |
| **2113** | `vsphere-syncer` | `vsphere_full_sync_ops_histogram`, `vsphere_cns_volume_pv_missing`, `vsphere_syncer_info` |

Both ports are exposed via the `vsphere-csi-controller` Service in the
`vmware-system-csi` namespace.

## Applying this profile

### Step 1 — Patch the Prometheus ConfigMap

```bash
# From the repo root
kubectl patch configmap prometheus-config \
  -n csi-driver-monitoring \
  --patch "$(cat driver-profiles/vsphere/prometheus-patch.yaml)"
```

Or apply the patch as a kustomize overlay — see `kustomize-overlay/` below.

### Step 2 — Copy the vSphere dashboards

```bash
cp driver-profiles/vsphere/dashboards/*.json dashboards/
```

Then rebuild the dashboard ConfigMap and restart Grafana:

```bash
kubectl apply -k .
kubectl rollout restart deployment/grafana -n csi-driver-monitoring
```

### Step 3 — Verify

In Prometheus UI (**Status → Targets**), confirm these jobs are `UP`:
- `csi-driver-sidecars`         — standard sidecar metrics
- `vsphere-csi-controller`      — port 2112
- `vsphere-csi-syncer`          — port 2113

## Testing with the mock stack

```bash
cd mock
DRIVER=vsphere docker compose up --build
```

The mock exporter will emit both standard `csi_sidecar_operations_seconds`
and the full vSphere-specific metric set.
