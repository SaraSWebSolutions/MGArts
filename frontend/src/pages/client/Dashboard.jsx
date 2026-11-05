import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Coins,
  Gem,
  HandCoins,
  Hammer,
  RefreshCw,
  Scale,
  Store,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { fetchData, jobsApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { dt, karat, money, wt } from "../../components/masterHelpers";
import "./dashboard.css";
import { Skeleton } from "../../components/Loaders";
import Breadcrumb from "../../components/Breadcrumb";
import "./QuickActions.css";

const TXN = {
  receipt: "Customer gold received",
  purchase: "Gold purchased",
  conversion_out: "Converted (out)",
  conversion_in: "Converted (in)",
  issue: "Issued to worker",
  scrap_return: "Scrap returned",
  finished: "Jewellery received",
  delivery: "Delivered to customer",
  sale: "Jewellery sold",
  reversal: "Reversal",
};
const COLORS = ["#e79d19", "#1ab58b", "#8c65d5", "#e35d70", "#3b87e7"];

function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`dash-panel ${className}`}>
      <div className="dash-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ClientDashboard() {
  const { name } = useAuth();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dashLoading, setDashLoading] = useState(true);
  const [pendLoading, setPendLoading] = useState(true);

  // two independent requests: each section shows its own loader until its data arrives
  const load = () => {
    fetchData("/dashboard")
      .then((r) => setD(r.data))
      .catch((err) => toast.error(getErrorMessage(err, "Failed to load dashboard")))
      .finally(() => {
        setBusy(false);
        setDashLoading(false);
      });
    jobsApi
      .page({ status: "issued", page: 1, limit: 7 })
      .then((r) => setPending(r.rows))
      .catch((err) => toast.error(getErrorMessage(err, "Failed to load jobs")))
      .finally(() => setPendLoading(false));
  };
  const refresh = () => {
    setBusy(true);
    setDashLoading(true);
    setPendLoading(true);
    load();
  };
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const hour = new Date().getHours();
  const greet =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const x = d || { chart: [], purities: {}, recent: [] };
  const maxBar = Math.max(
    10,
    ...x.chart.flatMap((c) => [c.received, c.issued, c.finished]),
  );
  const pur = Object.entries(x.purities);
  const purTotal = pur.reduce((s, [, v]) => s + v, 0);
  let acc = 0;
  const donut = purTotal
    ? `conic-gradient(${pur
        .map(([, v], i) => {
          const a = acc;
          acc += (v / purTotal) * 100;
          return `${COLORS[i % 5]} ${a}% ${acc}%`;
        })
        .join(",")})`
    : "conic-gradient(#e6e9ef 0 100%)";

  const kpis = [
    {
      label: "Own Gold Stock",
      value: wt(x.ownGold),
      sub: "raw gold, all purities",
      icon: Coins,
      tone: "amber",
    },
    {
      label: "Customer Gold",
      value: wt(x.customerGold),
      sub: "held for customers",
      icon: HandCoins,
      tone: "blue",
    },
    {
      label: "Own Jewellery",
      value: wt(x.ownJewelleryWeight),
      sub: `${x.ownJewelleryPieces ?? 0} pieces in stock`,
      icon: Gem,
      tone: "green",
    },
    {
      label: "Jobs With Workers",
      value: x.pendingJobs ?? 0,
      sub: `${x.completedJobs ?? 0} completed`,
      icon: Hammer,
      tone: "purple",
    },
    {
      label: "Making Charges Due",
      value: money(x.outstanding),
      sub: `of ${money(x.billed)} billed`,
      icon: Wallet,
      tone: "rose",
    },
  ];

  return (
    <div className="ppc-dashboard">
      <div className="dashboard-controls">
        <Breadcrumb />
        <div className="dash-filters">
          <label>
            <RefreshCw size={16} className={busy ? "spin" : ""} />
            <select
              aria-label="Refresh"
              value=""
              onChange={refresh}
            >
              <option value="">Refresh data</option>
              <option value="1">Refresh now</option>
            </select>
          </label>
        </div>
      </div>
      <div className="welcome-banner">
        <div className="welcome-copy">
          <span className="welcome-eyebrow">MG ARTS WORKSPACE</span>
          <h1>
            {greet}
            {name ? `, ${name}` : ""} <span>✳</span>
          </h1>
          <p>Live view of your gold, jewellery and job work.</p>
          <div className="welcome-chip">
            Own stock and customer stock · always kept apart
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <Gem size={116} strokeWidth={1} />
        </div>
      </div>
      <div className="modern-kpis">
        {kpis.map((k) => {
          const Icon = k.icon;
          return dashLoading ? (
            <article className={`modern-kpi tone-${k.tone}`} key={k.label} aria-busy="true">
              <div className="kpi-title">
                <span className="metric-icon">
                  <Icon size={21} />
                </span>
                <span>{k.label}</span>
              </div>
              <Skeleton width="60%" height={26} style={{ margin: "10px 0" }} />
              <Skeleton width="45%" height={10} />
            </article>
          ) : (
            <article className={`modern-kpi tone-${k.tone}`} key={k.label}>
              <div className="kpi-title">
                <span className="metric-icon">
                  <Icon size={21} />
                </span>
                <span>{k.label}</span>
              </div>
              <strong className="metric-value">{k.value}</strong>
              <div className="metric-bottom">
                <div>
                  <small>{k.sub}</small>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="main-analytics">
        <Panel
          title="Gold Movement"
          subtitle="Last 7 days · grams"
          className="production-chart-panel"
          action={<span className="soft-tag">Weekly</span>}
        >
          {dashLoading ? (
            <div aria-busy="true" style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 210, padding: "20px 8px 0" }}>
              {[60, 90, 45, 120, 80, 150, 100].map((h, i) => (
                <Skeleton key={i} width="100%" height={h} style={{ borderRadius: 8 }} />
              ))}
            </div>
          ) : (
            <>
          <div className="legend">
            <span>
              <i className="legend-dot planned" />
              Received / bought
            </span>
            <span>
              <i className="legend-dot actual" />
              Issued to workers
            </span>
          </div>
          <div className="production-chart">
            <div className="chart-y-axis">
              {[1, 0.75, 0.5, 0.25, 0].map((p) => (
                <span key={p}>{Math.round(maxBar * p)}</span>
              ))}
            </div>
            <div className="chart-plot">
              <div className="chart-lines">
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i} />
                ))}
              </div>
              <div className="chart-columns">
                {x.chart.map((c) => (
                  <div className="day-col" key={c.day}>
                    <div className="column-pair">
                      <div
                        title={`Received ${c.received} g`}
                        className="column planned"
                        style={{ height: `${(c.received / maxBar) * 100}%` }}
                      />
                      <div
                        title={`Issued ${c.issued} g`}
                        className="column actual"
                        style={{ height: `${(c.issued / maxBar) * 100}%` }}
                      />
                    </div>
                    <span>{c.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
            </>
          )}
        </Panel>
        <Panel
          title="Gold by Purity"
          subtitle="Raw gold in stock"
          className="order-status-panel"
        >
          {dashLoading ? (
            <div aria-busy="true" style={{ display: "grid", placeItems: "center", gap: 18, padding: "10px 0" }}>
              <Skeleton width={150} height={150} style={{ borderRadius: "50%" }} />
              <Skeleton width="80%" height={12} />
              <Skeleton width="65%" height={12} />
            </div>
          ) : (
            <>
          <div
            className="modern-donut"
            style={{ background: donut }}
            role="img"
            aria-label="Gold stock by purity"
          >
            <div>
              <strong>{Math.round(purTotal)}</strong>
              <small>grams</small>
            </div>
          </div>
          <div className="status-list">
            {pur.length === 0 && <small>No gold in stock yet</small>}
            {pur.map(([p, v], i) => (
              <div key={p}>
                <span>
                  <i
                    className="legend-dot"
                    style={{ background: COLORS[i % 5] }}
                  />
                  {karat(p) || p} · {p}
                </span>
                <b>{wt(v)}</b>
              </div>
            ))}
          </div>
            </>
          )}
        </Panel>
        <Panel
          title="Own vs Customer"
          subtitle="Stock held right now"
          className="performance-panel"
        >
          {dashLoading ? (
            <div aria-busy="true">
              <Skeleton width="100%" height={14} />
              <Skeleton width="100%" height={14} style={{ marginTop: 18 }} />
              <Skeleton width="100%" height={14} style={{ marginTop: 18 }} />
              <Skeleton width="70%" height={12} style={{ marginTop: 26 }} />
            </div>
          ) : (
            <>
          <div className="performance-table-wrap">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Raw gold</th>
                  <th>Jewellery</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Own</td>
                  <td>{wt(x.ownGold)}</td>
                  <td>{wt(x.ownJewelleryWeight)}</td>
                </tr>
                <tr>
                  <td>Customer</td>
                  <td>{wt(x.customerGold)}</td>
                  <td>{wt(x.customerJewelleryWeight)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="empty-state" style={{ marginTop: 14 }}>
            Sales last 30 days: <b>{money(x.sales30)}</b> ({x.salesCount30 ?? 0}{" "}
            bills) · Received: <b>{money(x.paid)}</b>
          </p>
            </>
          )}
        </Panel>
      </div>

      <div className="operations-grid ops-two">
        <Panel
          title="Gold With Workers"
          subtitle="Jobs waiting for jewellery"
          className="timeline-panel"
          action={
            <button className="text-action" onClick={() => nav("/jobs")}>
              All jobs <ArrowRight size={14} />
            </button>
          }
        >
          <div className="performance-table-wrap">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Worker</th>
                  <th>For</th>
                  <th>Weight</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {pendLoading &&
                  [0, 1, 2, 3].map((i) => (
                    <tr key={i} aria-hidden="true">
                      {[0, 1, 2, 3, 4].map((c) => (
                        <td key={c}>
                          <Skeleton width={c === 0 ? "70%" : "55%"} />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!pendLoading && pending.length === 0 && (
                  <tr>
                    <td colSpan={5} className="no-sample">
                      No pending jobs
                    </td>
                  </tr>
                )}
                {!pendLoading &&
                  pending.slice(0, 7).map((j) => (
                  <tr key={j.id}>
                    <td>{j.jobNo}</td>
                    <td>{j.worker?.name}</td>
                    <td>{j.customer?.name || "Own stock"}</td>
                    <td>{wt(j.issuedWeight)}</td>
                    <td>{dt(j.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="Recent Movements"
          subtitle="Latest stock entries"
          className="notifications-panel"
        >
          <div className="modern-alerts">
            {dashLoading &&
              [0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width="100%" height={38} style={{ marginBottom: 10, borderRadius: 10 }} />
              ))}
            {!dashLoading && x.recent.length === 0 && (
              <p className="empty-state">Nothing recorded yet</p>
            )}
            {!dashLoading &&
              x.recent.slice(0, 5).map((e) => (
              <div
                className={`modern-alert alert-${e.direction === "in" ? "success" : "warning"}`}
                key={e.id}
              >
                <span className="alert-badge">
                  <Scale size={16} />
                </span>
                <div>
                  <strong>{TXN[e.txnType] || e.txnType}</strong>
                  <small>
                    {wt(e.weight)} · {karat(e.purity) || e.purity} ·{" "}
                    {e.customer || "Own"}
                  </small>
                </div>
                <time>{dt(e.date)}</time>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="Quick Actions"
        subtitle="Jump into your workflow"
        className="quick-panel qa-wide"
      >
        <div className="qa-list">
          {[
            { label: "Receive Gold", sub: "Customer bar / old gold", icon: HandCoins, to: "/gold-receipts", c: "#e79d19" },
            { label: "Issue to Worker", sub: "Start a job work", icon: Hammer, to: "/jobs", c: "#8766d7" },
            { label: "Add Payment", sub: "Making charge received", icon: Wallet, to: "/billing", c: "#11ad84" },
            { label: "New Sale", sub: "Sell own jewellery", icon: Store, to: "/sales", c: "#e58a34" },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <button
                className="qa-item"
                style={{ "--c": a.c }}
                key={a.label}
                onClick={() => nav(a.to)}
              >
                <span className="qa-ico">
                  <Icon size={19} />
                </span>
                <span className="qa-text">
                  <strong>{a.label}</strong>
                  <small>{a.sub}</small>
                </span>
                <ArrowRight size={15} className="qa-go" />
              </button>
            );
          })}
          <button className="qa-reports" onClick={() => nav("/reports")}>
            <span className="qa-ico">
              <BarChart3 size={19} />
            </span>
            <span className="qa-text">
              <strong>Open Reports</strong>
              <small>Reconciliation, stock, GST &amp; more</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
      </Panel>
    </div>
  );
}
