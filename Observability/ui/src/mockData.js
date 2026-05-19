// Mock data matching what the mock-exporter emits at each SCENARIO level.
// Metric: csi_sidecar_operations_seconds{driver_name, grpc_status_code, method_name}
// Works with any CSI driver that uses standard Kubernetes CSI sidecars.

export const TIME_LABELS = [
  "-55m","-50m","-45m","-40m","-35m","-30m","-25m","-20m","-15m","-10m","-5m","now",
];

export const SCENARIOS = ["normal", "degraded", "failing"];

export const DATA = {
  normal: {
    totalOpsPerMin: 19.8,
    errorPct:       1.5,
    activeDrivers:  1,
    createVolP95:   4.8,
    latency: [
      { t: "-55m", p50: 1.2, p95: 3.8, p99: 8.2  },
      { t: "-50m", p50: 1.4, p95: 4.2, p99: 9.1  },
      { t: "-45m", p50: 1.1, p95: 3.5, p99: 7.8  },
      { t: "-40m", p50: 1.3, p95: 4.0, p99: 8.5  },
      { t: "-35m", p50: 1.5, p95: 4.5, p99: 9.5  },
      { t: "-30m", p50: 1.2, p95: 3.8, p99: 8.0  },
      { t: "-25m", p50: 1.4, p95: 4.1, p99: 8.8  },
      { t: "-20m", p50: 1.1, p95: 3.6, p99: 7.9  },
      { t: "-15m", p50: 1.3, p95: 3.9, p99: 8.3  },
      { t: "-10m", p50: 1.2, p95: 3.7, p99: 8.0  },
      { t: "-5m",  p50: 1.4, p95: 4.0, p99: 8.6  },
      { t: "now",  p50: 1.1, p95: 3.8, p99: 8.1  },
    ],
    opsByMethod: [
      { method: "Attach",          ops: 4.5 },
      { method: "Detach",          ops: 4.2 },
      { method: "CreateVolume",    ops: 3.2 },
      { method: "DeleteVolume",    ops: 2.8 },
      { method: "ListVolumes",     ops: 2.5 },
      { method: "ExpandVolume",    ops: 1.1 },
      { method: "CreateSnapshot",  ops: 0.8 },
      { method: "DeleteSnapshot",  ops: 0.7 },
    ],
    errorsByCode: [
      { code: "Unknown",      count: 0.18 },
      { code: "Unavailable",  count: 0.12 },
    ],
    distribution: [
      { name: "Attach/Detach", value: 52 },
      { name: "Create/Delete", value: 30 },
      { name: "List",          value: 13 },
      { name: "Snapshot",      value: 5  },
    ],
    summary: [
      { method: "Attach",         ops: 4.5, errPct: 1.1, p95: 3.9  },
      { method: "Detach",         ops: 4.2, errPct: 0.9, p95: 3.5  },
      { method: "CreateVolume",   ops: 3.2, errPct: 1.8, p95: 4.8  },
      { method: "DeleteVolume",   ops: 2.8, errPct: 1.2, p95: 3.1  },
      { method: "ListVolumes",    ops: 2.5, errPct: 0.3, p95: 1.2  },
      { method: "ExpandVolume",   ops: 1.1, errPct: 1.5, p95: 5.2  },
      { method: "CreateSnapshot", ops: 0.8, errPct: 2.1, p95: 6.8  },
      { method: "DeleteSnapshot", ops: 0.7, errPct: 0.8, p95: 2.9  },
    ],
  },

  degraded: {
    totalOpsPerMin: 15.2,
    errorPct:       6.4,
    activeDrivers:  1,
    createVolP95:   14.2,
    latency: [
      { t: "-55m", p50: 3.5, p95: 11.2, p99: 28.5 },
      { t: "-50m", p50: 4.2, p95: 13.5, p99: 32.1 },
      { t: "-45m", p50: 3.8, p95: 10.8, p99: 26.8 },
      { t: "-40m", p50: 5.1, p95: 15.1, p99: 38.5 },
      { t: "-35m", p50: 4.8, p95: 14.2, p99: 35.2 },
      { t: "-30m", p50: 5.5, p95: 16.5, p99: 42.1 },
      { t: "-25m", p50: 4.9, p95: 13.9, p99: 32.8 },
      { t: "-20m", p50: 6.2, p95: 18.2, p99: 45.5 },
      { t: "-15m", p50: 5.8, p95: 15.8, p99: 38.9 },
      { t: "-10m", p50: 6.5, p95: 17.5, p99: 43.2 },
      { t: "-5m",  p50: 5.9, p95: 16.2, p99: 40.1 },
      { t: "now",  p50: 6.8, p95: 18.9, p99: 47.5 },
    ],
    opsByMethod: [
      { method: "Attach",          ops: 3.8 },
      { method: "Detach",          ops: 3.5 },
      { method: "CreateVolume",    ops: 2.5 },
      { method: "DeleteVolume",    ops: 2.1 },
      { method: "ListVolumes",     ops: 1.8 },
      { method: "ExpandVolume",    ops: 0.9 },
      { method: "CreateSnapshot",  ops: 0.6 },
      { method: "DeleteSnapshot",  ops: 0.5 },
    ],
    errorsByCode: [
      { code: "Unknown",           count: 0.42 },
      { code: "Unavailable",       count: 0.35 },
      { code: "PermissionDenied",  count: 0.25 },
    ],
    distribution: [
      { name: "Attach/Detach", value: 48 },
      { name: "Create/Delete", value: 30 },
      { name: "List",          value: 12 },
      { name: "Snapshot",      value: 7  },
      { name: "Expand",        value: 3  },
    ],
    summary: [
      { method: "Attach",         ops: 3.8, errPct: 5.8,  p95: 14.1 },
      { method: "Detach",         ops: 3.5, errPct: 4.9,  p95: 12.5 },
      { method: "CreateVolume",   ops: 2.5, errPct: 7.2,  p95: 18.2 },
      { method: "DeleteVolume",   ops: 2.1, errPct: 5.5,  p95: 11.8 },
      { method: "ListVolumes",    ops: 1.8, errPct: 2.1,  p95: 4.5  },
      { method: "ExpandVolume",   ops: 0.9, errPct: 8.1,  p95: 22.5 },
      { method: "CreateSnapshot", ops: 0.6, errPct: 9.5,  p95: 28.1 },
      { method: "DeleteSnapshot", ops: 0.5, errPct: 4.2,  p95: 10.9 },
    ],
  },

  failing: {
    totalOpsPerMin: 7.7,
    errorPct:       29.5,
    activeDrivers:  1,
    createVolP95:   92.5,
    latency: [
      { t: "-55m", p50: 12.5, p95: 45.2,  p99: 95.2  },
      { t: "-50m", p50: 15.8, p95: 52.8,  p99: 115.8 },
      { t: "-45m", p50: 18.2, p95: 62.1,  p99: 138.5 },
      { t: "-40m", p50: 14.9, p95: 48.5,  p99: 102.5 },
      { t: "-35m", p50: 22.5, p95: 72.5,  p99: 158.2 },
      { t: "-30m", p50: 25.8, p95: 85.2,  p99: 185.5 },
      { t: "-25m", p50: 18.9, p95: 58.9,  p99: 125.8 },
      { t: "-20m", p50: 28.5, p95: 92.1,  p99: 198.5 },
      { t: "-15m", p50: 22.1, p95: 68.5,  p99: 145.2 },
      { t: "-10m", p50: 31.5, p95: 98.5,  p99: 215.5 },
      { t: "-5m",  p50: 25.8, p95: 75.2,  p99: 162.8 },
      { t: "now",  p50: 35.2, p95: 105.8, p99: 228.9 },
    ],
    opsByMethod: [
      { method: "Attach",          ops: 2.1 },
      { method: "Detach",          ops: 1.8 },
      { method: "CreateVolume",    ops: 1.2 },
      { method: "DeleteVolume",    ops: 0.8 },
      { method: "ListVolumes",     ops: 0.9 },
      { method: "ExpandVolume",    ops: 0.4 },
      { method: "CreateSnapshot",  ops: 0.3 },
      { method: "DeleteSnapshot",  ops: 0.2 },
    ],
    errorsByCode: [
      { code: "Unavailable",      count: 2.12 },
      { code: "Unknown",          count: 1.85 },
      { code: "Internal",         count: 0.85 },
      { code: "PermissionDenied", count: 0.52 },
    ],
    distribution: [
      { name: "Attach/Detach", value: 51 },
      { name: "Create/Delete", value: 26 },
      { name: "List",          value: 12 },
      { name: "Snapshot",      value: 7  },
      { name: "Expand",        value: 4  },
    ],
    summary: [
      { method: "Attach",         ops: 2.1, errPct: 28.5, p95: 88.2  },
      { method: "Detach",         ops: 1.8, errPct: 22.1, p95: 72.5  },
      { method: "CreateVolume",   ops: 1.2, errPct: 35.8, p95: 98.5  },
      { method: "DeleteVolume",   ops: 0.8, errPct: 25.2, p95: 68.1  },
      { method: "ListVolumes",    ops: 0.9, errPct: 8.5,  p95: 22.5  },
      { method: "ExpandVolume",   ops: 0.4, errPct: 42.5, p95: 125.8 },
      { method: "CreateSnapshot", ops: 0.3, errPct: 38.2, p95: 115.2 },
      { method: "DeleteSnapshot", ops: 0.2, errPct: 20.8, p95: 55.8  },
    ],
  },
};

export const SCENARIO_META = {
  normal:   { label: "Normal",   alertLevel: "success", message: "All operations within SLA. Error rate < 2%. Latency nominal." },
  degraded: { label: "Degraded", alertLevel: "warning", message: "Error rate elevated (~6%). Latency 3–5× above baseline. Investigate Unavailable/Unknown gRPC codes." },
  failing:  { label: "Failing",  alertLevel: "danger",  message: "~30% of ops failing. Latency in minutes. CreateVolume / ExpandVolume most impacted. Immediate action required." },
};

export const CHART_COLORS = ["#58a6ff", "#3fb950", "#d29922", "#f85149", "#a5f3fc"];
