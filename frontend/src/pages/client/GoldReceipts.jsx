import { useState } from "react";
import { HandCoins, Plus, Printer, Scale, Search, Ban } from "lucide-react";
import toast from "react-hot-toast";
import { receiptsApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { run, usePaged, useMasters } from "../../hooks";
import { Badge, CField, CSelect, Drawer, EmptyRow, Stat, ActionBtn } from "../../components/MasterUI";
import {
  PURITIES,
  clean,
  dt,
  karat,
  opts,
  today,
  wt,
} from "../../components/masterHelpers";
import PrintDoc from "../../components/PrintDoc";
import Pagination from "../../components/Pagination";
import Breadcrumb from "../../components/Breadcrumb";
import "./Masters.css";

const blankItem = () => ({
  kind: "bar",
  description: "",
  weight: "",
  purity: "999",
});
const blank = () => ({
  customer: "",
  date: today(),
  items: [blankItem()],
  rate: "",
  notes: "",
});

export default function GoldReceipts() {
  const { can } = useAuth();
  const { customers } = useMasters();
  const [f, setF] = useState({ customer: "", from: "", to: "" });
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
  } = usePaged((p) => receiptsApi.page({ ...clean(f), ...p }), [f]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState(null);

  const setItem = (i, k, v) =>
    setForm((p) => ({
      ...p,
      items: p.items.map((it, n) => (n === i ? { ...it, [k]: v } : it)),
    }));
  const total = form
    ? form.items.reduce((s, i) => s + (Number(i.weight) || 0), 0)
    : 0;
  const fine = form
    ? form.items.reduce(
        (s, i) => s + ((Number(i.weight) || 0) * Number(i.purity)) / 1000,
        0,
      )
    : 0;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await receiptsApi.create({
        ...form,
        items: form.items.map((i) => ({
          ...i,
          weight: Number(i.weight),
          purity: Number(i.purity),
        })),
        rate: Number(form.rate) || 0,
      });
      toast.success("Gold receipt saved to customer stock");
      setForm(null);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save receipt"));
    } finally {
      setSaving(false);
    }
  };
  const voidIt = async (r) => {
    if (
      !window.confirm(
        `Void ${r.receiptNo}? The gold is removed from customer stock again.`,
      )
    )
      return;
    if (
      await run(
        () => receiptsApi.void(r.id),
        "Receipt voided",
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
          <h1>Customer Gold Receipts</h1>
          <p>
            Gold bars and old gold given by customers. It is added to Customer
            Stock only - never to your own stock.
          </p>
        </div>
        {can("receipts-manage") && (
          <button className="primary-btn" onClick={() => setForm(blank())}>
            <Plus size={16} /> New Receipt
          </button>
        )}
      </header>
      <div className="master-stats">
        <Stat
          icon={HandCoins}
          loading={!summary}
          value={summary?.count ?? 0}
          label="Receipts"
        />
        <Stat
          icon={Scale}
          loading={!summary}
          value={wt(summary?.totalWeight)}
          label="Gold Received"
        />
        <Stat
          icon={Scale}
          loading={!summary}
          value={wt(summary?.fineWeight)}
          label="Fine Gold"
        />
      </div>
      <section className="master-card">
        <div className="master-toolbar">
          <div className="master-search">
            <Search size={15} />
            <input
              placeholder="Search receipt no or customer..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <select
              value={f.customer}
              onChange={(e) => setF({ ...f, customer: e.target.value })}
            >
              <option value="">All customers</option>
              {opts(customers).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Customer</th>
                <th>Items</th>
                <th className="num">Weight</th>
                <th className="num">Fine gold</th>
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
                        <HandCoins size={16} />
                      </span>
                      <div>
                        <strong>{r.receiptNo}</strong>
                        <small>{dt(r.date)}</small>
                      </div>
                    </div>
                  </td>
                  <td>{r.customer?.name || "—"}</td>
                  <td>
                    {r.items
                      .map(
                        (i) =>
                          `${i.kind === "bar" ? "Bar" : "Old"} ${karat(i.purity) || i.purity}`,
                      )
                      .join(", ")}
                  </td>
                  <td className="num">{wt(r.totalWeight)}</td>
                  <td className="num">{wt(r.fineWeight)}</td>
                  <td>
                    {r.status === "void" ? (
                      <Badge tone="grey">Void</Badge>
                    ) : (
                      <Badge tone="green">Active</Badge>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="icon-square"
                        title="Print receipt"
                        onClick={() => setDoc(r)}
                      >
                        <Printer size={14} />
                      </button>
                      {can("receipts-manage") && r.status === "active" && (
                        <ActionBtn icon={Ban} label="Void receipt" tone="danger" onClick={() => voidIt(r)} />
                      )}
                    </div>
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
          label="receipts"
        />
      </section>

      {form && (
        <Drawer
          wide
          title="New Customer Gold Receipt"
          subtitle="Goes to Customer Stock"
          onClose={() => setForm(null)}
          onSave={save}
          saving={saving}
          saveLabel="Save Receipt"
        >
          <CSelect
            label="Customer"
            required
            value={form.customer}
            onChange={(v) => setForm({ ...form, customer: v })}
            options={opts(customers, (c) => `${c.name} (${c.code})`)}
            placeholder="Select customer"
          />
          <CField
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
          />
          <div className="line-items">
            {form.items.map((it, i) => (
              <div className="line-row" key={i}>
                <CSelect
                  label={i === 0 ? "Type" : ""}
                  value={it.kind}
                  onChange={(v) => setItem(i, "kind", v)}
                  options={[
                    { value: "bar", label: "Gold bar" },
                    { value: "old", label: "Old gold" },
                  ]}
                />
                <CField
                  label={i === 0 ? "Description" : ""}
                  value={it.description}
                  onChange={(v) => setItem(i, "description", v)}
                  placeholder="e.g. chain, bar no."
                />
                <CField
                  label={i === 0 ? "Weight (g)" : ""}
                  type="number"
                  step="0.001"
                  required
                  value={it.weight}
                  onChange={(v) => setItem(i, "weight", v)}
                />
                <CSelect
                  label={i === 0 ? "Purity" : ""}
                  value={it.purity}
                  onChange={(v) => setItem(i, "purity", v)}
                  options={PURITIES}
                />
                <button
                  type="button"
                  className="icon-square danger"
                  disabled={form.items.length === 1}
                  onClick={() =>
                    setForm({
                      ...form,
                      items: form.items.filter((_, n) => n !== i),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="add-line-btn"
              onClick={() =>
                setForm({ ...form, items: [...form.items, blankItem()] })
              }
            >
              <Plus size={13} /> Add item
            </button>
          </div>
          <div className="calc-box">
            <div>
              <span>Total weight</span>
              <strong>{wt(total)}</strong>
            </div>
            <div>
              <span>Fine gold</span>
              <strong>{wt(fine)}</strong>
            </div>
          </div>
          <CField
            label="Rate per gram (optional)"
            type="number"
            value={form.rate}
            onChange={(v) => setForm({ ...form, rate: v })}
          />
          <CField
            label="Notes"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
          />
        </Drawer>
      )}
      {doc && (
        <PrintDoc type="gold-receipt" data={doc} onClose={() => setDoc(null)} />
      )}
    </div>
  );
}
