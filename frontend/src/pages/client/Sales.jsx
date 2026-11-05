import { useEffect, useState } from "react";
import { Plus, Printer, Search, Store, Ban } from "lucide-react";
import toast from "react-hot-toast";
import { jewelleryApi, salesApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { run, usePaged, useMasters } from "../../hooks";
import { Badge, CField, CSelect, Drawer, EmptyRow, Stat, ActionBtn } from "../../components/MasterUI";
import Pagination from "../../components/Pagination";
import {
  dt,
  isActive,
  karat,
  money,
  today,
  wt,
} from "../../components/masterHelpers";
import PrintDoc from "../../components/PrintDoc";
import TaxPicker from "../../components/TaxPicker";
import Breadcrumb from "../../components/Breadcrumb";
import "./Masters.css";

const blank = (taxIds) => ({
  buyerName: "",
  buyerMobile: "",
  date: today(),
  mode: "cash",
  taxRates: taxIds || [],
  items: [{ jewellery: "", amount: "" }],
});

export default function Sales() {
  const { can } = useAuth();
  const { taxRates } = useMasters();
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
  } = usePaged((p) => salesApi.page(p), []);
  const [stock, setStock] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    if (form)
      jewelleryApi
        .list({ owner: "own", status: "in_stock" })
        .then(setStock)
        .catch(() => {});
  }, [!!form]); // eslint-disable-line react-hooks/exhaustive-deps

  const setItem = (i, k, v) =>
    setForm((p) => ({
      ...p,
      items: p.items.map((it, n) => (n === i ? { ...it, [k]: v } : it)),
    }));
  const chosen = form ? form.items.map((i) => i.jewellery) : [];
  const sub = form
    ? form.items.reduce((s, i) => s + (Number(i.amount) || 0), 0)
    : 0;

  const taxLines = form
    ? taxRates
        .filter((t) => form.taxRates.includes(t.id))
        .map((t) => ({ name: t.name, rate: t.rate, amount: Math.round(sub * t.rate) / 100 }))
    : [];
  const taxTotal = taxLines.reduce((s, t) => s + t.amount, 0);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await salesApi.create({
        ...form,
        items: form.items.map((i) => ({
          jewellery: i.jewellery,
          amount: Number(i.amount),
        })),
      });
      toast.success("Sale saved");
      setForm(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save sale"));
    } finally {
      setSaving(false);
    }
  };
  const voidIt = async (r) => {
    if (
      window.confirm(`Void ${r.invoiceNo}? Items return to stock.`) &&
      (await run(() => salesApi.void(r.id), "Sale voided"))
    )
      reload();
  };

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <Breadcrumb />
          <h1>Own Jewellery Sales</h1>
          <p>
            Jewellery made from your own gold and sold from the shop. Customer
            jewellery cannot be sold here.
          </p>
        </div>
        {can("sales-manage") && (
          <button
            className="primary-btn"
            onClick={() =>
              setForm(
                blank(
                  taxRates
                    .filter(
                      (t) =>
                        t.type === "sale" && t.isDefault && isActive(t.status),
                    )
                    .map((t) => t.id),
                ),
              )
            }
          >
            <Plus size={16} /> New Sale
          </button>
        )}
      </header>
      <div className="master-stats">
        <Stat
          icon={Store}
          loading={!summary}
          value={summary?.count ?? 0}
          label="Sales"
        />
        <Stat
          icon={Store}
          loading={!summary}
          value={money(summary?.total)}
          label="Sales Value"
        />
        <Stat
          icon={Store}
          loading={!summary}
          value={wt(summary?.weight)}
          label="Weight Sold"
        />
      </div>
      <section className="master-card">
        <div className="master-toolbar">
          <div className="master-search">
            <Search size={15} />
            <input
              placeholder="Search invoice or buyer..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Buyer</th>
                <th>Items</th>
                <th className="num">GST</th>
                <th className="num">Total</th>
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
                        <Store size={16} />
                      </span>
                      <div>
                        <strong>{r.invoiceNo}</strong>
                        <small>{dt(r.date)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {r.buyerName}
                    <span className="sub">{r.buyerMobile}</span>
                  </td>
                  <td>{r.items.map((i) => i.tag).join(", ")}</td>
                  <td className="num">{money(r.gstAmount)}</td>
                  <td className="num">{money(r.total)}</td>
                  <td>
                    {r.status === "void" ? (
                      <Badge tone="grey">Void</Badge>
                    ) : (
                      <Badge tone="green">Sold</Badge>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="icon-square" title="Print invoice" onClick={() => setDoc(r)}>
                        <Printer size={14} />
                      </button>
                      {can("sales-manage") && r.status === "active" && (
                        <ActionBtn icon={Ban} label="Void sale" tone="danger" onClick={() => voidIt(r)} />
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
          label="sales"
        />
      </section>

      {form && (
        <Drawer
          wide
          title="New Jewellery Sale"
          subtitle="Only own jewellery in stock can be sold"
          onClose={() => setForm(null)}
          onSave={save}
          saving={saving}
          saveLabel="Save Sale"
        >
          <CField
            label="Buyer name"
            value={form.buyerName}
            onChange={(v) => setForm({ ...form, buyerName: v })}
            placeholder="Walk-in"
          />
          <CField
            label="Mobile"
            value={form.buyerMobile}
            onChange={(v) => setForm({ ...form, buyerMobile: v })}
          />
          <CField
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
          />
          <CSelect
            label="Payment mode"
            value={form.mode}
            onChange={(v) => setForm({ ...form, mode: v })}
            options={["cash", "upi", "card", "bank"]}
          />
          <div className="line-items">
            {form.items.map((it, i) => (
              <div className="line-row sale" key={i}>
                <CSelect
                  label={i === 0 ? "Jewellery" : ""}
                  required
                  value={it.jewellery}
                  onChange={(v) => setItem(i, "jewellery", v)}
                  placeholder="Select item"
                  options={stock
                    .filter(
                      (s) => s.id === it.jewellery || !chosen.includes(s.id),
                    )
                    .map((s) => ({
                      value: s.id,
                      label: `${s.tag} · ${s.name} · ${wt(s.weight)} · ${karat(s.purity) || s.purity}`,
                    }))}
                />
                <CField
                  label={i === 0 ? "Amount (₹)" : ""}
                  type="number"
                  step="0.01"
                  required
                  value={it.amount}
                  onChange={(v) => setItem(i, "amount", v)}
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
                setForm({
                  ...form,
                  items: [...form.items, { jewellery: "", amount: "" }],
                })
              }
            >
              <Plus size={13} /> Add item
            </button>
          </div>
          <TaxPicker
            label="Taxes (optional)"
            taxes={taxRates.filter(
              (t) => t.type !== "making" && (isActive(t.status) || form.taxRates.includes(t.id)),
            )}
            value={form.taxRates}
            onChange={(v) => setForm({ ...form, taxRates: v })}
          />
          <div className="calc-box">
            <div>
              <span>Sub-total</span>
              <strong>{money(sub)}</strong>
            </div>
            {taxLines.map((t) => (
              <div key={t.name}>
                <span>
                  {t.name} {t.rate}%
                </span>
                <strong>{money(t.amount)}</strong>
              </div>
            ))}
            <div>
              <span>Total</span>
              <strong>{money(sub + taxTotal)}</strong>
            </div>
          </div>
        </Drawer>
      )}
      {doc && <PrintDoc type="sale" data={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}
