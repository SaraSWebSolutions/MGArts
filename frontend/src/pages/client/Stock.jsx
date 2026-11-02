import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import toast from "react-hot-toast";
import { fetchData } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useMasters } from "../../hooks";
import { Badge, EmptyRow, Tabs } from "../../components/MasterUI";
import { clean, dt, karat, opts, wt } from "../../components/masterHelpers";
import "./Masters.css";

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
  const [bal, setBal] = useState([]);
  const [led, setLed] = useState({ data: [], summary: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    Promise.all([
      fetchData(
        "/stock/balances",
        clean({ owner: f.owner, customer: f.customer, item: f.item }),
      ),
      fetchData("/stock/ledger", clean(f)),
    ])
      .then(([b, l]) => {
        if (alive) {
          setBal(b.data);
          setLed(l);
        }
      })
      .catch((e) => toast.error(getErrorMessage(e, "Failed to load stock")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [f]);

  const set = (k, v) =>
    setF((p) => ({
      ...p,
      [k]: v,
      ...(k === "owner" && v !== "customer" ? { customer: "" } : {}),
    }));
  const sum = led.summary;

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <span className="master-eyebrow">STOCK / LEDGER</span>
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
        {bal.filter((b) => b.balance !== 0).length === 0 && !loading && (
          <div className="master-note" style={{ gridColumn: "1/-1" }}>
            No stock balance yet.
          </div>
        )}
        {bal
          .filter((b) => b.balance !== 0)
          .map((b) => (
            <div
              className="bal-card"
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
        {sum && (
          <div className="ledger-sum">
            {[
              ["Opening", "opening"],
              ["Received", "in"],
              ["Issued / out", "out"],
              ["Closing", "closing"],
            ].map(([l, k]) => (
              <div key={k}>
                <span>{l}</span>
                <strong>Gold {wt(sum.gold[k])}</strong>
                <span>Jewellery {wt(sum.jewellery[k])}</span>
              </div>
            ))}
          </div>
        )}
        {sum?.byType?.length > 0 && (
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
              {led.data.length === 0 && (
                <EmptyRow colSpan={7} loading={loading} />
              )}
              {led.data.map((e) => (
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
        <div className="master-footer">
          <Scale size={12} style={{ verticalAlign: -2 }} /> Showing latest{" "}
          {led.data.length} movements
        </div>
      </section>
    </div>
  );
}
