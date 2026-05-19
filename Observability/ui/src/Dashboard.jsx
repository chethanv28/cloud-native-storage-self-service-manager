import { useState } from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { DATA, SCENARIO_META, CHART_COLORS } from "./mockData";
import "./Dashboard.css";

// ─── helpers ─────────────────────────────────────────────────────────────────

function errTone(pct) {
  if (pct >= 15) return "danger";
  if (pct >= 5)  return "warning";
  return "success";
}
function latTone(s) {
  if (s >= 30) return "danger";
  if (s >= 15) return "warning";
  return "success";
}

// ─── sub-components ──────────────────────────────────────────────────────────

function KpiCard({ value, label, tone }) {
  return (
    <div className={`kpi-card kpi-card--${tone ?? "default"}`}>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="section-card">
      <div className="section-card__header">
        <span className="section-card__title">{title}</span>
        {subtitle && <span className="section-card__sub">{subtitle}</span>}
      </div>
      <div className="section-card__body">{children}</div>
    </div>
  );
}

function StatusRow({ method, ops, errPct, p95 }) {
  const tone = errTone(errPct);
  const label = errPct >= 15 ? "Critical" : errPct >= 5 ? "Elevated" : "OK";
  return (
    <tr className={`summary-row summary-row--${tone}`}>
      <td className="summary-method">{method}</td>
      <td className="summary-num">{ops.toFixed(1)}</td>
      <td className={`summary-num summary-pct--${tone}`}>{errPct.toFixed(1)}%</td>
      <td className={`summary-num summary-lat--${latTone(p95)}`}>{p95.toFixed(1)}s</td>
      <td><span className={`badge badge--${tone}`}>{label}</span></td>
    </tr>
  );
}

const TOOLTIP_STYLE = {
  backgroundColor: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 6,
  color: "#e6edf3",
  fontSize: 12,
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [scenario, setScenario] = useState("normal");
  const d    = DATA[scenario];
  const meta = SCENARIO_META[scenario];

  return (
    <div className="dashboard">

      {/* Header */}
      <header className="dash-header">
        <div className="dash-header__title-group">
          <h1 className="dash-title">CSI Driver — Volume Operations</h1>
          <p className="dash-subtitle">
            Metric: <code>csi_sidecar_operations_seconds</code> · any Kubernetes CSI driver · last 1 h (mock data)
          </p>
        </div>
        <div className="scenario-pills">
          {["normal", "degraded", "failing"].map((s) => (
            <button
              key={s}
              className={`pill pill--${s} ${scenario === s ? "pill--active" : ""}`}
              onClick={() => setScenario(s)}
            >
              {SCENARIO_META[s].label}
            </button>
          ))}
        </div>
      </header>

      {/* Alert banner */}
      <div className={`alert-banner alert-banner--${meta.alertLevel}`}>
        <strong>{meta.alertLevel === "success" ? "Healthy" : meta.alertLevel === "warning" ? "Degraded" : "Outage"}</strong>
        &ensp;{meta.message}
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        <KpiCard value={`${d.totalOpsPerMin.toFixed(1)}`}  label="Total ops / min" />
        <KpiCard value={`${d.errorPct.toFixed(1)}%`}       label="Error rate"    tone={errTone(d.errorPct)} />
        <KpiCard value={`${d.activeDrivers}`}              label="Active drivers" />
        <KpiCard value={`${d.createVolP95.toFixed(1)}s`}   label="CreateVolume p95" tone={latTone(d.createVolP95)} />
      </div>

      {/* Latency + Ops by method */}
      <div className="charts-row">
        <SectionCard
          title="Operation latency — p50 / p95 / p99"
          subtitle="Successful ops only · seconds"
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.latency} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="t" tick={{ fill: "#8b949e", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} unit="s" width={40} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}s`]} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#8b949e" }} />
              <Line type="monotone" dataKey="p50" stroke="#3fb950" strokeWidth={2} dot={false} name="p50" />
              <Line type="monotone" dataKey="p95" stroke="#d29922" strokeWidth={2} dot={false} name="p95" />
              <Line type="monotone" dataKey="p99" stroke="#f85149" strokeWidth={2} dot={false} name="p99" />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard
          title="Operations per minute by method"
          subtitle="Last 5 min avg"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={d.opsByMethod}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 80, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 11 }} unit=" ops" />
              <YAxis type="category" dataKey="method" tick={{ fill: "#8b949e", fontSize: 11 }} width={80} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} ops/min`]} />
              <Bar dataKey="ops" fill="#58a6ff" radius={[0, 4, 4, 0]} name="Ops/min" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Errors + Distribution */}
      <div className="charts-row">
        <SectionCard
          title="Errors per minute by gRPC status code"
          subtitle="Non-OK responses only"
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={d.errorsByCode}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 110, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 11 }} unit=" err/min" />
              <YAxis type="category" dataKey="code" tick={{ fill: "#8b949e", fontSize: 11 }} width={110} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} err/min`]} />
              <Bar dataKey="count" fill="#f85149" radius={[0, 4, 4, 0]} name="Errors/min" />
            </BarChart>
          </ResponsiveContainer>
          <p className="chart-caption">
            Unavailable = storage unreachable · Unknown = internal driver error ·
            Internal = unexpected · PermissionDenied = RBAC / auth issue
          </p>
        </SectionCard>

        <SectionCard
          title="Operation type distribution"
          subtitle="Share of total ops · last 5 min"
        >
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={d.distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) =>
                    percent > 0.08 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                  }
                  labelLine={false}
                >
                  {d.distribution.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Summary table */}
      <section className="summary-section">
        <h2 className="section-heading">Per-Method Summary — last 5 min</h2>
        <div className="table-wrap">
          <table className="summary-table">
            <thead>
              <tr>
                <th>Method</th>
                <th className="th-num">Ops / min</th>
                <th className="th-num">Error %</th>
                <th className="th-num">p95 Latency</th>
                <th className="th-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {d.summary.map((row) => (
                <StatusRow key={row.method} {...row} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="chart-caption" style={{ marginTop: 8 }}>
          Source: <code>csi_sidecar_operations_seconds</code> · labels: <code>driver_name</code>,{" "}
          <code>grpc_status_code</code>, <code>method_name</code> · standard Kubernetes CSI sidecars
        </p>
      </section>

    </div>
  );
}
