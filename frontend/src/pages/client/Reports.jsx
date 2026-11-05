import { useState } from "react";
import { Download } from "lucide-react";
import toast from "react-hot-toast";
import { fetchData } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { usePaged, useSettings } from "../../hooks";
import { EmptyRow, Tabs } from "../../components/MasterUI";
import { Skeleton } from "../../components/Loaders";
import Pagination from "../../components/Pagination";
import { clean, dt, money, wt } from "../../components/masterHelpers";
import Breadcrumb from "../../components/Breadcrumb";
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
  const [exporting, setExporting] = useState(false);
  const { settings } = useSettings();

  // every report is paginated by the backend; totals & extra cards cover the whole report
  const {
    rows,
    meta,
    summary: rep,
    loading,
    setPage,
    limit,
    setLimit,
  } = usePaged(
    async (p) => {
      const r = await fetchData(`/reports/${tab}`, { ...clean(f), ...p });
      return {
        rows: r.data.rows,
        meta: r.meta ?? null,
        summary: {
          tab,
          columns: r.data.columns,
          totals: r.data.totals,
          extra: r.extra || null,
        },
      };
    },
    [tab, f],
  );
  const columns = rep?.tab === tab ? rep.columns : []; // never show the previous tab's headings
  const extra = !loading && rep?.tab === tab ? rep.extra : null;
  const totals = rep?.tab === tab ? rep.totals : null;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const r = await fetchData(`/reports/${tab}`, { ...clean(f), all: "1" }); // every row, not just this page
      const cols = r.data.columns;
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [cols.map((c) => esc(c.label)).join(",")];
      r.data.rows.forEach((row) =>
        lines.push(
          cols
            .map((c) => esc(c.type === "date" ? dt(row[c.key]) : row[c.key]))
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
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to export"));
    } finally {
      setExporting(false);
    }
  };
  const alertPct = settings?.wastageAlertPercent;
  const dated = ["reconciliation", "making-gst"].includes(tab);
  const tabMeta = TABS.find((t) => t.value === tab);

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <Breadcrumb />
          <h1>Reports</h1>
          <p>{tabMeta.note}</p>
        </div>
        <button
          className="primary-btn"
          onClick={exportCsv}
          disabled={!rows.length || exporting}
        >
          <Download size={16} /> {exporting ? "Exporting..." : "Export CSV"}
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
        {tab === "own-stock" && loading && (
          <div className="ledger-sum" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton width={90} height={10} />
                <Skeleton width={110} height={14} style={{ marginTop: 9 }} />
              </div>
            ))}
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
                {columns.map((c) => (
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
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={columns.length || 6}
                  loading={loading}
                  rows={limit}
                />
              )}
              {rows.map((r) => (
                <tr key={r.id || JSON.stringify(r)}>
                  {columns.map((c) => {
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
            {totals && !loading && rows.length > 0 && (
              <tfoot>
                <tr>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={
                        ["wt", "money", "pct"].includes(c.type) ? "num" : ""
                      }
                    >
                      {fmt(c.type, totals[c.key])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <Pagination
          meta={meta}
          loading={loading}
          limit={limit}
          onPage={setPage}
          onLimit={setLimit}
          label="rows"
        />
        {tab === "reconciliation" && alertPct ? (
          <div className="master-footer">
            Wastage above {alertPct}% is highlighted. Totals cover all pages.
          </div>
        ) : null}
      </section>
    </div>
  );
}
