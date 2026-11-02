import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import toast from "react-hot-toast";
import { fetchData } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useSettings } from "../../hooks";
import { EmptyRow, Tabs } from "../../components/MasterUI";
import { clean, dt, money, wt } from "../../components/masterHelpers";
import "./Masters.css";

const TABS = [
  {
    value: "reconciliation",
    label: "Job reconciliation",
    note: "Issued vs jewellery vs scrap vs wastage for every job.",
  },
  {
    value: "customer-balance",
    label: "Customer stock",
    note: "Gold received, converted, issued and jewellery balance per customer.",
  },
  {
    value: "own-stock",
    label: "Own stock",
    note: "Own gold and jewellery balance with purchases and sales.",
  },
  {
    value: "worker-jobs",
    label: "Worker summary",
    note: "Pending jobs and gold currently held by each worker.",
  },
  {
    value: "making-gst",
    label: "Making charges & GST",
    note: "Invoices, GST collected, payments and outstanding.",
  },
];
const fmt = (type, v) =>
  v === undefined || v === null || v === ""
    ? ""
    : type === "wt"
      ? wt(v)
      : type === "money"
        ? money(v)
        : type === "pct"
          ? `${v}%`
          : type === "date"
            ? dt(v)
            : v;

export default function Reports() {
  const [tab, setTab] = useState("reconciliation");
  const [f, setF] = useState({ from: "", to: "", owner: "" });
  const [rep, setRep] = useState({ columns: [], rows: [], totals: null });
  const [extra, setExtra] = useState(null);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();

  useEffect(() => {
    let alive = true;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetchData(`/reports/${tab}`, clean(f))
      .then((r) => {
        if (alive) {
          setRep(r.data);
          setExtra(r.extra || null);
        }
      })
      .catch((e) => toast.error(getErrorMessage(e, "Failed to load report")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tab, f]);

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [rep.columns.map((c) => esc(c.label)).join(",")];
    rep.rows.forEach((r) =>
      lines.push(
        rep.columns
          .map((c) => esc(c.type === "date" ? dt(r[c.key]) : r[c.key]))
          .join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const alertPct = settings?.wastageAlertPercent;
  const dated = ["reconciliation", "making-gst"].includes(tab);
  const meta = TABS.find((t) => t.value === tab);

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <span className="master-eyebrow">REPORTS</span>
          <h1>Reports</h1>
          <p>{meta.note}</p>
        </div>
        <button
          className="primary-btn"
          onClick={exportCsv}
          disabled={!rep.rows.length}
        >
          <Download size={16} /> Export CSV
        </button>
      </header>
      <Tabs value={tab} onChange={setTab} items={TABS} />
      <section className="master-card">
        {(dated || tab === "reconciliation") && (
          <div className="master-toolbar">
            <div className="filter-group">
              {tab === "reconciliation" && (
                <select
                  value={f.owner}
                  onChange={(e) => setF({ ...f, owner: e.target.value })}
                >
                  <option value="">Own + customer</option>
                  <option value="own">Own only</option>
                  <option value="customer">Customer only</option>
                </select>
              )}
              {dated && (
                <>
                  <input
                    type="date"
                    value={f.from}
                    onChange={(e) => setF({ ...f, from: e.target.value })}
                    title="From"
                  />
                  <input
                    type="date"
                    value={f.to}
                    onChange={(e) => setF({ ...f, to: e.target.value })}
                    title="To"
                  />
                </>
              )}
            </div>
          </div>
        )}
        {extra && (
          <div className="ledger-sum">
            <div>
              <span>Gold purchased</span>
              <strong>{wt(extra.goldPurchasedWeight)}</strong>
            </div>
            <div>
              <span>Gold purchase cost</span>
              <strong>{money(extra.goldPurchasedAmount)}</strong>
            </div>
            <div>
              <span>Tools & equipment</span>
              <strong>{money(extra.toolsAmount)}</strong>
            </div>
            <div>
              <span>Jewellery sales</span>
              <strong>{money(extra.salesAmount)}</strong>
            </div>
          </div>
        )}
        <div className="master-table-wrap">
          <table className="master-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                {rep.columns.map((c) => (
                  <th
                    key={c.key}
                    className={
                      ["wt", "money", "pct"].includes(c.type) ? "num" : ""
                    }
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rep.rows.length === 0 && (
                <EmptyRow colSpan={rep.columns.length || 1} loading={loading} />
              )}
              {rep.rows.map((r) => (
                <tr key={r.id || JSON.stringify(r)}>
                  {rep.columns.map((c) => {
                    const hot =
                      tab === "reconciliation" &&
                      c.key === "wastagePct" &&
                      alertPct &&
                      r.wastagePct > alertPct;
                    return (
                      <td
                        key={c.key}
                        className={
                          ["wt", "money", "pct"].includes(c.type) ? "num" : ""
                        }
                        style={
                          hot
                            ? { color: "#c2394b", fontWeight: 700 }
                            : undefined
                        }
                      >
                        {fmt(c.type, r[c.key])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {rep.totals && rep.rows.length > 0 && (
              <tfoot>
                <tr>
                  {rep.columns.map((c) => (
                    <td
                      key={c.key}
                      className={
                        ["wt", "money", "pct"].includes(c.type) ? "num" : ""
                      }
                    >
                      {fmt(c.type, rep.totals[c.key])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="master-footer">
          {rep.rows.length} rows
          {tab === "reconciliation" && alertPct
            ? ` · wastage above ${alertPct}% is highlighted`
            : ""}
        </div>
      </section>
    </div>
  );
}
