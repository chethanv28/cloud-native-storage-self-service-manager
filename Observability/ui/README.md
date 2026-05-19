# CSI Driver Observability — Dashboard UI

React-based volume operations dashboard. Works with any Kubernetes CSI driver
that uses the standard sidecar containers.

## Quick start

```bash
cd ui
npm install
npm run dev        # http://localhost:5173
```

## Build for production

```bash
npm run build      # outputs to ui/dist/
```

Serve `dist/` with any static file server or drop it into an S3/GCS bucket.

## Connecting to a live Prometheus

The current implementation uses embedded mock data (see `src/mockData.js`).
To connect to a real Prometheus endpoint, replace the `DATA` object in
`mockData.js` with `fetch()` calls to the Prometheus HTTP API:

```js
// Example — fetch CreateVolume p95 latency for the last hour
const url = 'http://localhost:9090/api/v1/query_range'
  + '?query=histogram_quantile(0.95,sum by(le)(rate(csi_sidecar_operations_seconds_bucket{method_name=~".*/CreateVolume"}[5m])))'
  + '&start=' + (Date.now()/1000 - 3600) + '&end=' + Date.now()/1000 + '&step=300';
const resp = await fetch(url);
const json = await resp.json();
```

## Scenarios (mock mode)

Use the pills in the top-right corner to toggle between simulated conditions:

| Scenario | Error rate | Latency |
|---|---|---|
| Normal   | ~1.5%  | baseline |
| Degraded | ~6.4%  | 3–5× baseline |
| Failing  | ~29.5% | 10–100× baseline |
