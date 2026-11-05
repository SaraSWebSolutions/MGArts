import { useEffect, useState } from "react";
import { FlaskConical, Plus, Scale, Search, Ban } from "lucide-react";
import toast from "react-hot-toast";
import { conversionsApi, fetchData } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { run, usePaged, useMasters } from "../../hooks";
import { Badge, CField, CSelect, Drawer, EmptyRow, Stat, ActionBtn } from "../../components/MasterUI";
import Pagination from "../../components/Pagination";
import {
  OWNER_LABEL,
  PURITIES,
  dt,
  karat,
  opts,
  today,
  wt,
} from "../../components/masterHelpers";
import Breadcrumb from "../../components/Breadcrumb";
import "./Masters.css";

const blank = () => ({
  owner: "customer",
  customer: "",
  date: today(),
  sourcePurity: "999",
  targetPurity: "916",
  inputWeight: "",
  convertedTo: "",
  notes: "",
});

export default function Conversions() {
  const { can } = useAuth();
  const { customers } = useMasters();
  const [owner, setOwner] = useState("");
  const {
    rows,
    meta,
    summary,
    loading,
    reload,
    setPage,
    limit,
    setLimit,
    q,
    setQ,
  } = usePaged((p) => conversionsApi.page({ ...(owner ? { owner } : {}), ...p }),
    [owner]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [avail, setAvail] = useState(null);

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

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <Breadcrumb />
          <h1>Gold Conversion</h1>
          <p>
            Change gold from one purity to another: 24K → 22K (alloy added),
            22K → 22K (melt and re-cast), or 22K → 24K (refining, alloy
            removed). Fine gold stays the same. Every conversion is kept as
            history.
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
        <Stat
          icon={FlaskConical}
          loading={!summary}
          value={summary?.count ?? 0}
          label="Conversions"
        />
        <Stat
          icon={Scale}
          loading={!summary}
          value={wt(summary?.inputWeight)}
          label="Gold Converted"
        />
        <Stat
          icon={Scale}
          loading={!summary}
          value={wt(summary?.alloyAdded)}
          label="Alloy Added / (Removed)"
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
              {rows.length === 0 && (
                <EmptyRow colSpan={7} loading={loading} rows={limit} />
              )}
              {rows.map((r) => (
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
                    {r.convertedTo && (
                      <span className="sub">→ {r.convertedTo}</span>
                    )}
                  </td>
                  <td className="num">
                    {r.alloyAdded < -0.0004 ? "− " : ""}
                    {wt(Math.abs(r.alloyAdded))}
                  </td>
                  <td>
                    {r.status === "void" ? (
                      <Badge tone="grey">Void</Badge>
                    ) : (
                      <Badge tone="green">Active</Badge>
                    )}
                  </td>
                  <td>
                    {can("conversions-manage") && r.status === "active" && (
                      <ActionBtn icon={Ban} label="Void conversion" tone="danger" onClick={() => voidIt(r)} />
                    )}
                  </td>
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
          label="conversions"
        />
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
              <span>{out - input < -0.0004 ? "Alloy removed" : "Alloy added"}</span>
              <strong>{wt(Math.abs(out - input))}</strong>
            </div>
          </div>
          <CField
            full
            label="Converted to (optional)"
            placeholder="e.g. Gold bar, Chain, Ring, Bangle"
            value={form.convertedTo}
            onChange={(v) => setForm({ ...form, convertedTo: v })}
          />
          <div className="master-note">
            Conversion keeps the gold as gold (only the purity or form changes).
            To make a chain, ring or any new jewellery, issue this gold to a
            worker in Job Work.
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
