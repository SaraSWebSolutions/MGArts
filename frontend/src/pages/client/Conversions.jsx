import { useEffect, useState } from "react";
import { FlaskConical, Plus, Scale, Search } from "lucide-react";
import toast from "react-hot-toast";
import { conversionsApi, fetchData } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { run, useList, useMasters } from "../../hooks";
import {
  Badge,
  CField,
  CSelect,
  Drawer,
  EmptyRow,
  Stat,
} from "../../components/MasterUI";
import {
  OWNER_LABEL,
  PURITIES,
  dt,
  karat,
  opts,
  today,
  wt,
} from "../../components/masterHelpers";
import "./Masters.css";

const blank = () => ({
  owner: "customer",
  customer: "",
  date: today(),
  sourcePurity: "999",
  targetPurity: "916",
  inputWeight: "",
  notes: "",
});

export default function Conversions() {
  const { can } = useAuth();
  const { customers } = useMasters();
  const [owner, setOwner] = useState("");
  const { rows, loading, reload } = useList(
    () => conversionsApi.list(owner ? { owner } : {}),
    [owner],
  );
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [avail, setAvail] = useState(null);
  const [q, setQ] = useState("");

  // show how much gold of the chosen purity is actually available
  const key = form ? `${form.owner}|${form.customer}|${form.sourcePurity}` : "";
  useEffect(() => {
    if (!key) return undefined;
    const [o, c, p] = key.split("|");
    if (o === "customer" && !c) return undefined;
    let alive = true;
    fetchData("/stock/balances", {
      owner: o,
      customer: c || undefined,
      item: "gold",
    })
      .then((r) => {
        if (alive)
          setAvail(r.data.find((b) => String(b.purity) === p)?.balance ?? 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  const input = Number(form?.inputWeight) || 0;
  const out = form
    ? (input * Number(form.sourcePurity)) / Number(form.targetPurity)
    : 0;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await conversionsApi.create({
        ...form,
        customer: form.owner === "customer" ? form.customer : undefined,
        inputWeight: Number(form.inputWeight),
      });
      toast.success("Conversion saved");
      setForm(null);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save conversion"));
    } finally {
      setSaving(false);
    }
  };
  const voidIt = async (r) => {
    if (
      !window.confirm(
        `Void ${r.convNo}? Converted gold must still be in stock.`,
      )
    )
      return;
    if (
      await run(
        () => conversionsApi.void(r.id),
        "Conversion voided",
        "Could not void",
      )
    )
      reload();
  };
  const shown = rows.filter((r) =>
    `${r.convNo}${r.customer?.name || "own"}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const active = rows.filter((r) => r.status === "active");

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <span className="master-eyebrow">TRANSACTIONS / CONVERSION</span>
          <h1>Gold Conversion (24K → 22K)</h1>
          <p>
            Alloy is added to pure gold. 100 g of 24K becomes about 109.17 g of
            22K. Every conversion is kept as history.
          </p>
        </div>
        {can("conversions-manage") && (
          <button
            className="primary-btn"
            onClick={() => {
              setAvail(null);
              setForm(blank());
            }}
          >
            <Plus size={16} /> New Conversion
          </button>
        )}
      </header>
      <div className="master-stats">
        <Stat icon={FlaskConical} value={active.length} label="Conversions" />
        <Stat
          icon={Scale}
          value={wt(active.reduce((s, r) => s + r.inputWeight, 0))}
          label="Gold Converted"
        />
        <Stat
          icon={Scale}
          value={wt(active.reduce((s, r) => s + r.alloyAdded, 0))}
          label="Alloy Added"
        />
      </div>
      <section className="master-card">
        <div className="master-toolbar">
          <div className="master-search">
            <Search size={15} />
            <input
              placeholder="Search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">All stock</option>
              <option value="customer">Customer stock</option>
              <option value="own">Own stock</option>
            </select>
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Conversion</th>
                <th>Stock</th>
                <th className="num">Input</th>
                <th className="num">Output</th>
                <th className="num">Alloy</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && <EmptyRow colSpan={7} loading={loading} />}
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="name-cell">
                      <span className="row-icon">
                        <FlaskConical size={16} />
                      </span>
                      <div>
                        <strong>{r.convNo}</strong>
                        <small>{dt(r.date)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={r.owner === "own" ? "amber" : "blue"}>
                      {OWNER_LABEL[r.owner]}
                    </Badge>
                    <span className="sub">{r.customer?.name || ""}</span>
                  </td>
                  <td className="num">
                    {wt(r.inputWeight)}
                    <span className="sub">
                      {karat(r.sourcePurity)} · {r.sourcePurity}
                    </span>
                  </td>
                  <td className="num">
                    {wt(r.outputWeight)}
                    <span className="sub">
                      {karat(r.targetPurity) || ""} · {r.targetPurity}
                    </span>
                  </td>
                  <td className="num">{wt(r.alloyAdded)}</td>
                  <td>
                    {r.status === "void" ? (
                      <Badge tone="grey">Void</Badge>
                    ) : (
                      <Badge tone="green">Active</Badge>
                    )}
                  </td>
                  <td>
                    {can("conversions-manage") && r.status === "active" && (
                      <button
                        className="act-text red"
                        onClick={() => voidIt(r)}
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="master-footer">{shown.length} conversions</div>
      </section>

      {form && (
        <Drawer
          title="New Gold Conversion"
          subtitle="Converted gold stays in the same stock"
          onClose={() => setForm(null)}
          onSave={save}
          saving={saving}
          saveLabel="Convert"
        >
          <CSelect
            label="Stock"
            required
            value={form.owner}
            onChange={(v) => setForm({ ...form, owner: v })}
            options={[
              { value: "customer", label: "Customer stock" },
              { value: "own", label: "Own stock" },
            ]}
          />
          <CField
            label="Date"
            type="date"
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
            required
          />
          {form.owner === "customer" && (
            <CSelect
              full
              label="Customer"
              required
              value={form.customer}
              onChange={(v) => setForm({ ...form, customer: v })}
              options={opts(customers, (c) => `${c.name} (${c.code})`)}
              placeholder="Select customer"
            />
          )}
          <CSelect
            label="From purity"
            value={form.sourcePurity}
            onChange={(v) => setForm({ ...form, sourcePurity: v })}
            options={PURITIES}
          />
          <CSelect
            label="To purity"
            value={form.targetPurity}
            onChange={(v) => setForm({ ...form, targetPurity: v })}
            options={PURITIES}
          />
          <CField
            full
            label="Gold weight to convert (g)"
            type="number"
            step="0.001"
            required
            value={form.inputWeight}
            onChange={(v) => setForm({ ...form, inputWeight: v })}
          />
          {avail !== null && (
            <div className="master-note">
              Available in this stock at {form.sourcePurity}: <b>{wt(avail)}</b>
            </div>
          )}
          <div className="calc-box">
            <div>
              <span>Fine gold (unchanged)</span>
              <strong>{wt((input * Number(form.sourcePurity)) / 1000)}</strong>
            </div>
            <div>
              <span>Converted weight</span>
              <strong>{wt(out)}</strong>
            </div>
            <div>
              <span>Alloy added</span>
              <strong>{wt(out - input)}</strong>
            </div>
          </div>
          <CField
            full
            label="Notes"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
          />
        </Drawer>
      )}
    </div>
  );
}
