# CSI Driver Observability

Prometheus + Grafana observability stack for **any Kubernetes CSI driver** that
exposes Prometheus metrics. Works out of the box with every driver that uses the
standard Kubernetes CSI sidecar containers (`external-provisioner`,
`external-attacher`, `external-resizer`, `external-snapshotter`).

> **Quick local demo — no Kubernetes required:**
> ```bash
> cd mock && docker compose up --build
> # Open http://localhost:3000 (admin / changeme)
> ```

![CSI Driver — Volume Operations Dashboard](docs/images/dashboard-preview.svg)

---

## How it works

Every CSI driver that follows the Kubernetes CSI sidecar model emits a standard
histogram metric:

```
csi_sidecar_operations_seconds{driver_name, grpc_status_code, method_name}
```

This metric is emitted by the standard sidecar containers and covers every
volume lifecycle operation — `CreateVolume`, `DeleteVolume`,
`ControllerPublishVolume` (attach), `ControllerUnpublishVolume` (detach),
`ControllerExpandVolume` (resize), `CreateSnapshot`, `DeleteSnapshot`, and more.

This repo scrapes that metric and renders an operations dashboard that lets
storage admins instantly answer:

| Question | How |
|---|---|
| How many volume operations are in flight per minute? | `Total Op Rate` stat |
| What percentage of operations are failing? | `Error Rate` stat |
| Which operation has the worst latency? | `CSI Operation Latency — p95 by Method` |
| What gRPC error codes are occurring? | `Errors by gRPC Status Code` |
| Per-driver, per-method operation summary? | `Operation Summary Table` |

---

## Repository layout

```
csi-driver-observability/
├── deploy/
│   ├── namespace.yaml                         Kubernetes namespace (csi-driver-monitoring)
│   ├── prometheus/
│   │   ├── rbac.yaml                          ClusterRole + ServiceAccount for Prometheus
│   │   ├── configmap.yaml                     prometheus.yml + recording rules
│   │   ├── deployment.yaml                    Prometheus Deployment
│   │   └── service.yaml                       NodePort :30090
│   └── grafana/
│       ├── secret.yaml                        Admin credentials (change before deploy!)
│       ├── datasource-cm.yaml                 Prometheus datasource
│       ├── dashboard-provider-cm.yaml         Grafana provisioning config
│       ├── deployment.yaml                    Grafana Deployment
│       └── service.yaml                       NodePort :30300
├── dashboards/
│   ├── CSI-Operations-Dashboard-v1.0.json     Standard dashboard (any CSI driver)
│   └── CSI-Custom-Template-v1.0.json          Blank template for driver-specific panels
├── driver-profiles/
│   └── vsphere/
│       ├── README.md                          How to apply the vSphere extras
│       ├── prometheus-patch.yaml              Additional scrape jobs for ports 2112/2113
│       └── dashboards/                        vSphere-specific dashboard JSONs (copy here)
├── mock/
│   ├── docker-compose.yml                     Local dev stack (no Kubernetes needed)
│   ├── prometheus-mock.yml                    Prometheus config for Docker Compose
│   ├── grafana-provisioning/                  Grafana auto-provisioning for Docker Compose
│   └── mock-exporter/
│       ├── Dockerfile
│       ├── requirements.txt
│       └── exporter.py                        Mock Prometheus exporter
└── kustomization.yaml                         Kustomize entry point
```

---

## Deploying to Kubernetes

### Step 1 — Configure scrape targets

Edit `deploy/prometheus/configmap.yaml` and replace the placeholder target(s)
with your CSI driver's actual service endpoint and metrics port:

```yaml
scrape_configs:
  - job_name: csi-driver-sidecars
    static_configs:
      - targets:
          # Format: <k8s-service>.<namespace>.svc.cluster.local:<metrics-port>
          - my-csi-controller.kube-system.svc.cluster.local:9809
        labels:
          component: csi-sidecars
```

Common sidecar metrics ports:

| Sidecar | Default `--metrics-address` port |
|---|---|
| `external-provisioner` | 9809 (configurable) |
| `external-attacher`    | 9809 (configurable) |
| `external-resizer`     | 9809 (configurable) |
| `external-snapshotter` | 9809 (configurable) |

Check your CSI driver's Kubernetes Service manifest or Helm chart values for the
exact port number. Many drivers publish this in their documentation.

### Step 2 — Change the Grafana password

Edit `deploy/grafana/secret.yaml` and replace the base64-encoded password:

```bash
echo -n 'my-secure-password' | base64
```

### Step 3 — Apply

```bash
kubectl apply -k .
```

### Step 4 — Open dashboards

```bash
kubectl get nodes -o wide   # get a node IP
# Prometheus: http://<node-ip>:30090
# Grafana:    http://<node-ip>:30300   (admin / your-password)
```

---

## Local mock stack (Docker Compose)

No Kubernetes required. The mock exporter generates realistic traffic at three
configurable severity scenarios.

### Quick start

```bash
cd mock
docker compose up --build
```

- Grafana:    **http://localhost:3000** (admin / changeme)
- Prometheus: **http://localhost:9090**
- Metrics:    **http://localhost:9809/metrics**

### Switch scenarios

Edit the `SCENARIO` variable in `mock/docker-compose.yml` (or pass via CLI):

| Scenario | Error rate | Latency |
|---|---|---|
| `normal`   | ~1.5 %   | baseline |
| `degraded` | ~6 %     | 1.5–3× baseline |
| `failing`  | ~30 %    | 4–10× baseline |

```bash
SCENARIO=failing docker compose up --build
```

### Driver profiles

```bash
# Generic mode — standard csi_sidecar_operations_seconds only
DRIVER=generic docker compose up --build

# vSphere mode — also emits vsphere_csi_* and vsphere_cns_* on ports 2112/2113
DRIVER=vsphere docker compose up --build
```

### Sample PromQL commands

```bash
PROM=http://localhost:9090

# Operations per minute by method
curl -sg "$PROM/api/v1/query" \
  --data-urlencode 'query=sum by(method_name) (rate(csi_sidecar_operations_seconds_count[5m])) * 60' \
  | python3 -m json.tool

# p95 latency for successful operations (seconds)
curl -sg "$PROM/api/v1/query" \
  --data-urlencode 'query=histogram_quantile(0.95, sum by(le, method_name) (rate(csi_sidecar_operations_seconds_bucket{grpc_status_code="OK"}[5m])))' \
  | python3 -m json.tool

# Error rate (%) across all methods
curl -sg "$PROM/api/v1/query" \
  --data-urlencode 'query=100 * sum(rate(csi_sidecar_operations_seconds_count{grpc_status_code!="OK"}[5m])) / sum(rate(csi_sidecar_operations_seconds_count[5m]))' \
  | python3 -m json.tool

# vSphere: inaccessible volume count
curl -sg "$PROM/api/v1/query" \
  --data-urlencode 'query=vsphere_volume_health_gauge{volume_health_type="inaccessible-volumes"}' \
  | python3 -m json.tool
```

---

## Adapting for a different CSI driver

1. **Prometheus scrape targets** — edit `deploy/prometheus/configmap.yaml` as
   described in Step 1 above.
2. **Driver-specific dashboards** — copy `dashboards/CSI-Custom-Template-v1.0.json`
   and fill in your driver's metric names. Drop the JSON file into `dashboards/`
   so kustomize picks it up.
3. **Driver profile** — duplicate `driver-profiles/vsphere/` as a reference and
   create a new directory for your driver with its own README and prometheus patch.
4. **Mock exporter** — set `DRIVER_NAME` in docker-compose to your driver's CSI
   driver name string (e.g., `pd.csi.storage.gke.io`, `ebs.csi.aws.com`).

---

## Driver profiles

| Profile | Metrics source | Extra metrics |
|---|---|---|
| `generic` | Standard K8s CSI sidecars | None (standard `csi_sidecar_operations_seconds` only) |
| `vsphere` | vSphere CSI driver v3.x | `vsphere_csi_volume_ops_histogram`, `vsphere_cns_volume_ops_histogram`, `vsphere_request_ops_seconds`, `vsphere_volume_health_gauge`, `vsphere_full_sync_ops_histogram`, `vsphere_cns_volume_pv_missing` |

See [`driver-profiles/vsphere/README.md`](driver-profiles/vsphere/README.md) for
the vSphere setup guide.

---

## Dashboard UI (React app)

A standalone React dashboard is included in `ui/` for ad-hoc viewing or
embedding into an internal portal — no Grafana required.

```bash
cd ui
npm install
npm run dev     # http://localhost:5173
npm run build   # outputs static files to ui/dist/
```

The UI uses the same mock data as the Docker Compose stack and supports the
same three scenarios (Normal / Degraded / Failing) via interactive toggle pills.
See [`ui/README.md`](ui/README.md) for details on connecting to a live Prometheus.

---

## License

Apache 2.0
