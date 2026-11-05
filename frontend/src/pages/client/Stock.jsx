import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { fetchData } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { usePaged, useMasters } from "../../hooks";
import { Badge, EmptyRow, Tabs } from "../../components/MasterUI";
import { Skeleton } from "../../components/Loaders";
import Pagination from "../../components/Pagination";
import { clean, dt, karat, opts, wt } from "../../components/masterHelpers";
import Breadcrumb from "../../components/Breadcrumb";
import "./Masters.css";
import "./StockCards.css";

const TXN = {
  receipt: "Customer receipt",
  purchase: "Purchase",
  opening: "Opening stock",
  conversion_out: "Conversion (out)",
  conversion_in: "Conversion (in)",
  issue: "Issued to worker",
  scrap_return: "Scrap returned",
  finished: "Jewellery received",
  delivery: "Delivered",
  sale: "Sold",
  reversal: "Reversal",
};

export default function Stock() {
  const { customers } = useMasters();
  const [f, setF] = useState({
    owner: "",
    customer: "",
    item: "",
    txnType: "",
    from: "",
    to: "",
  });
  // 1) balance cards - own request, own loader
  const [bal, setBal] = useState([]);
  const [balLoading, setBalLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setBalLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetchData(
      "/stock/balances",
      clean({ owner: f.owner, customer: f.customer, item: f.item }),
    )
      .then((b) => alive && setBal(b.data))
      .catch((e) => toast.error(getErrorMessage(e, "Failed to load balances")))
      .finally(() => alive && setBalLoading(false));
    return () => {
      alive = false;
    };
  }, [f.owner, f.customer, f.item]);

  // 2) ledger table + its totals - paginated by the backend
  const {
    rows,
    meta,
    summary: sum,
    loading,
    setPage,
    limit,
    setLimit,
  } = usePaged(
    async (p) => {
      const r = await fetchData("/stock/ledger", { ...clean(f), ...p });
      return { rows: r.data, meta: r.meta ?? null, summary: r.summary ?? null };
    },
    [f],
  );

  const set = (k, v) =>
    setF((p) => ({
      ...p,
      [k]: v,
      ...(k === "owner" && v !== "customer" ? { customer: "" } : {}),
    }));

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <Breadcrumb />
          <h1>Stock Ledger</h1>
          <p>
            Every gram in and out. Own stock and customer stock are always kept
            apart.
          </p>
        </div>
      </header>
      <Tabs
        value={f.owner}
        onChange={(v) => set("owner", v)}
        items={[
          { value: "", label: "All stock" },
          { value: "own", label: "Own stock" },
          { value: "customer", label: "Customer stock" },
        ]}
      />
      <div className="balance-grid">
        {balLoading &&
          [0, 1, 2].map((i) => (
            <div className="bal-card" key={i} aria-busy="true">
              <Skeleton width="55%" height={10} />
              <Skeleton width="42%" height={22} style={{ margin: "12px 0" }} />
              <Skeleton width="78%" height={10} />
            </div>
          ))}
        {!balLoading && bal.filter((b) => b.balance !== 0).length === 0 && (
          <div className="master-note" style={{ gridColumn: "1/-1" }}>
            No stock balance yet.
          </div>
        )}
        {!balLoading &&
          bal
            .filter((b) => b.balance !== 0)
            .map((b) => (
              <div
                className={`bal-card ${
                  b.owner === "own"
                    ? b.item === "gold"
                      ? "st-amber"
                      : "st-green"
                    : b.item === "gold"
                      ? "st-blue"
                      : "st-purple"
                }`}
                key={`${b.owner}${b.customer}${b.item}${b.purity}`}
              >
                <small>
                  {b.owner === "own"
                    ? "OWN"
                    : (b.customerName || "CUSTOMER").toUpperCase()}{" "}
                  · {b.item === "gold" ? "RAW GOLD" : "JEWELLERY"}
                </small>
                <strong>{wt(b.balance)}</strong>
                <span>
                  {karat(b.purity)} · {b.purity} purity · fine{" "}
                  {wt((b.balance * b.purity) / 1000)}
                </span>
              </div>
            ))}
      </div>
      <section className="master-card">
        <div className="master-toolbar" style={{ flexWrap: "wrap" }}>
          <div className="filter-group" style={{ flexWrap: "wrap" }}>
            {f.owner === "customer" && (
              <select
                value={f.customer}
                onChange={(e) => set("customer", e.target.value)}
              >
                <option value="">All customers</option>
                {opts(customers).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <select
              value={f.item}
              onChange={(e) => set("item", e.target.value)}
            >
              <option value="">Gold + jewellery</option>
              <option value="gold">Raw gold</option>
              <option value="jewellery">Jewellery</option>
            </select>
            <select
              value={f.txnType}
              onChange={(e) => set("txnType", e.target.value)}
            >
              <option value="">All movements</option>
              {Object.entries(TXN).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={f.from}
              onChange={(e) => set("from", e.target.value)}
              title="From"
            />
            <input
              type="date"
              value={f.to}
              onChange={(e) => set("to", e.target.value)}
              title="To"
            />
          </div>
        </div>
        {loading || !sum ? (
          <div className="ledger-sum" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton width={60} height={10} />
                <Skeleton width={110} height={14} style={{ margin: "9px 0" }} />
                <Skeleton width={90} height={10} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="ledger-sum">
              {[
                ["Opening", "opening"],
                ["Received", "in"],
                ["Issued / out", "out"],
                ["Closing", "closing"],
              ].map(([l, k]) => (
                <div
                  key={k}
                  className={`sum-card ${{ opening: "st-blue", in: "st-green", out: "st-amber", closing: "st-purple" }[k]}`}
                >
                  <span>{l}</span>
                  <strong>Gold {wt(sum.gold[k])}</strong>
                  <span>Jewellery {wt(sum.jewellery[k])}</span>
                </div>
              ))}
            </div>
            {sum.byType?.length > 0 && (
              <div className="ledger-sum" style={{ flexWrap: "wrap" }}>
                {sum.byType.map((b) => (
                  <div key={`${b.txnType}${b.direction}`}>
                    <span>
                      {TXN[b.txnType] || b.txnType} (
                      {b.direction === "in" ? "in" : "out"})
                    </span>
                    <strong>{wt(b.weight)}</strong>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className="master-table-wrap">
          <table className="master-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Date / ref</th>
                <th>Stock</th>
                <th>Movement</th>
                <th>Item</th>
                <th className="num">In</th>
                <th className="num">Out</th>
                <th>Worker</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={7} loading={loading} rows={limit} />
              )}
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{dt(e.date)}</strong>
                    <span className="sub">{e.refNo}</span>
                  </td>
                  <td>
                    <Badge tone={e.owner === "own" ? "amber" : "blue"}>
                      {e.owner === "own" ? "Own" : "Customer"}
                    </Badge>
                    <span className="sub">{e.customer?.name || ""}</span>
                  </td>
                  <td>
                    {TXN[e.txnType] || e.txnType}
                    {e.note && <span className="sub">{e.note}</span>}
                  </td>
                  <td>
                    {e.item === "gold" ? "Gold" : "Jewellery"}
                    <span className="sub">
                      {karat(e.purity)} · {e.purity}
                    </span>
                  </td>
                  <td className="num">
                    {e.direction === "in" ? wt(e.weight) : ""}
                  </td>
                  <td className="num">
                    {e.direction === "out" ? wt(e.weight) : ""}
                  </td>
                  <td>{e.worker?.name || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          meta={meta}
          loading={loading}
          limit={limit}
          onPage={setPage}
          onLimit={setLimit}
          label="movements"
        />
      </section>
    </div>
  );
}
