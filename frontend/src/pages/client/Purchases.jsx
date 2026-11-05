import { useState } from "react";
import { Gem, Plus, Scale, Search, ShoppingCart, Wrench, Ban } from "lucide-react";
import toast from "react-hot-toast";
import { purchasesApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { run, usePaged, useMasters } from "../../hooks";
import { Badge, CField, CSelect, Drawer, EmptyRow, Stat, Tabs, ActionBtn } from "../../components/MasterUI";
import Pagination from "../../components/Pagination";
import {
  PURITIES,
  dt,
  isActive,
  karat,
  money,
  today,
  wt,
} from "../../components/masterHelpers";
import Breadcrumb from "../../components/Breadcrumb";
import "./Masters.css";

const ENTRY_TYPES = [
  { value: "purchase", label: "Bought from a supplier" },
  { value: "opening", label: "Opening stock (already with me)" },
];
const blankPiece = () => ({
  name: "",
  product: "",
  grossWeight: "",
  stoneWeight: "",
  purity: "916",
});
const blank = (kind) => ({
  kind,
  entryType: "purchase",
  supplierId: "",
  supplier: "",
  invoiceNo: "",
  date: today(),
  weight: "",
  purity: "999",
  rate: "",
  amount: "",
  amountEdited: false,
  itemName: "",
  size: "",
  quantity: "1",
  location: "Shop",
  pieces: [blankPiece()],
  notes: "",
});
const TABS = {
  gold: {
    button: "Add Gold",
    title: "Add Gold (Own Stock)",
    sub: "Adds to your own gold stock",
    icon: Scale,
  },
  jewellery: {
    button: "Add Jewellery",
    title: "Add Jewellery (Own Stock)",
    sub: "Each piece gets a tag in Jewellery Stock",
    icon: Gem,
  },
  tool: {
    button: "Add Tool",
    title: "Tool / Equipment Purchase",
    sub: "Purchase register (no gold stock effect)",
    icon: Wrench,
  },
};

export default function Purchases() {
  const { can } = useAuth();
  const { workers } = useMasters();
  const [kind, setKind] = useState("gold");
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
  } = usePaged((p) => purchasesApi.page({ kind, ...p }), [kind]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const tab = TABS[kind];
  const Icon = tab.icon;
  const opening = form?.entryType === "opening";

  const num = (v) => (Number(v) || 0);
  const net = (p) => Math.max(num(p.grossWeight) - num(p.stoneWeight), 0);
  const jewelWeight = form && kind === "jewellery" ? form.pieces.reduce((s, p) => s + net(p), 0) : 0;
  /** every change recalculates the amount, until the user types an amount himself */
  const upd = (patch) =>
    setForm((f) => {
      const n = { ...f, ...patch };
      if ("amount" in patch) n.amountEdited = true;
      else if (!n.amountEdited) {
        const c =
          n.kind === "gold"
            ? num(n.weight) * num(n.rate)
            : n.kind === "jewellery"
              ? n.pieces.reduce((t, p) => t + net(p), 0) * num(n.rate)
              : num(n.quantity) * num(n.rate);
        n.amount = c > 0 ? String(Math.round(c * 100) / 100) : "";
      }
      return n;
    });
  const setPiece = (i, k, v) =>
    upd({ pieces: form.pieces.map((p, n) => (n === i ? { ...p, [k]: v } : p)) });
  const amountField = (
    <CField
      label={opening ? "Amount (optional)" : "Amount (₹)"}
      type="number"
      step="0.01"
      required={!opening}
      full={kind === "jewellery"}
      value={form?.amount}
      onChange={(v) => upd({ amount: v })}
      placeholder="Total bill amount"
    />
  );

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form };
      ["weight", "purity", "rate", "amount", "quantity"].forEach((k) => {
        body[k] = body[k] === "" ? undefined : Number(body[k]);
      });
      delete body.amountEdited;
      if (!body.supplierId) delete body.supplierId;
      if (kind === "jewellery")
        body.pieces = form.pieces.map((p) => ({
          ...p,
          grossWeight: Number(p.grossWeight),
          stoneWeight: Number(p.stoneWeight) || 0,
          purity: Number(p.purity),
        }));
      else delete body.pieces;
      await purchasesApi.create(body);
      toast.success(
        kind === "tool"
          ? "Tool purchase saved"
          : `${kind === "gold" ? "Gold" : "Jewellery"} added to own stock`,
      );
      setForm(null);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };
  const voidIt = async (r) => {
    if (!window.confirm(`Void ${r.purchaseNo}?`)) return;
    if (
      await run(
        () => purchasesApi.void(r.id),
        "Entry voided",
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
          <h1>Add Own Stock</h1>
          <p>
            Add gold, ready-made jewellery or tools to your own shop - bought
            from a supplier, or entered as opening stock you already have.
          </p>
        </div>
        {can("purchases-manage") && (
          <button className="primary-btn" onClick={() => setForm(blank(kind))}>
            <Plus size={16} /> {tab.button}
          </button>
        )}
      </header>
      <Tabs
        value={kind}
        onChange={setKind}
        items={[
          { value: "gold", label: "Gold bar / old gold" },
          { value: "jewellery", label: "Ready jewellery" },
          { value: "tool", label: "Tools & equipment" },
        ]}
      />
      <div className="master-stats">
        <Stat
          icon={ShoppingCart}
          loading={!summary}
          value={summary?.count ?? 0}
          label="Entries"
        />
        {kind === "tool" ? (
          <Stat
            icon={Wrench}
            loading={!summary}
            value={summary?.quantity ?? 0}
            label="Items"
          />
        ) : (
          <Stat
            icon={kind === "gold" ? Scale : Gem}
            loading={!summary}
            value={wt(summary?.weight)}
            label={kind === "gold" ? "Gold Added" : "Jewellery (net)"}
          />
        )}
        <Stat
          icon={ShoppingCart}
          loading={!summary}
          value={money(summary?.amount)}
          label="Total Spent"
        />
      </div>
      <section className="master-card">
        <div className="master-toolbar">
          <div className="master-search">
            <Search size={15} />
            <input
              placeholder="Search supplier, item, size, invoice..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Entry</th>
                <th>Supplier / vendor</th>
                <th>
                  {kind === "gold"
                    ? "Weight / purity"
                    : kind === "jewellery"
                      ? "Pieces"
                      : "Tool"}
                </th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={6} loading={loading} rows={limit} />
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="name-cell">
                      <span className="row-icon">
                        <Icon size={16} />
                      </span>
                      <div>
                        <strong>{r.purchaseNo}</strong>
                        <small>
                          {dt(r.date)}
                          {r.invoiceNo ? ` · ${r.invoiceNo}` : ""}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {r.entryType === "opening" ? (
                      <Badge tone="blue">Opening stock</Badge>
                    ) : (
                      r.supplier || "—"
                    )}
                  </td>
                  <td>
                    {kind === "gold" && (
                      <>
                        {wt(r.weight)}
                        <span className="sub">
                          {karat(r.purity)} · {r.purity}
                          {r.rate ? ` · ${money(r.rate)}/g` : ""}
                        </span>
                      </>
                    )}
                    {kind === "jewellery" && (
                      <>
                        {r.quantity} pcs · {wt(r.weight)}
                        <span className="sub">
                          {(r.pieces || []).map((p) => p.tag).join(", ")}
                        </span>
                      </>
                    )}
                    {kind === "tool" && (
                      <>
                        {r.itemName}
                        <span className="sub">
                          {r.size ? `Size ${r.size} · ` : ""}Qty {r.quantity}
                          {r.rate ? ` × ${money(r.rate)}` : ""}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="num">{money(r.amount)}</td>
                  <td>
                    {r.status === "void" ? (
                      <Badge tone="grey">Void</Badge>
                    ) : (
                      <Badge tone="green">Active</Badge>
                    )}
                  </td>
                  <td>
                    {can("purchases-manage") && r.status === "active" && (
                      <ActionBtn icon={Ban} label="Void entry" tone="danger" onClick={() => voidIt(r)} />
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
          label="entries"
        />
      </section>

      {form && (
        <Drawer
          title={tab.title}
          subtitle={tab.sub}
          onClose={() => setForm(null)}
          onSave={save}
          saving={saving}
          wide={kind === "jewellery"}
        >
          {kind !== "tool" && (
            <CSelect
              full
              label="How did this stock come?"
              value={form.entryType}
              onChange={(v) => setForm({ ...form, entryType: v })}
              options={ENTRY_TYPES}
            />
          )}
          {!opening && (
            <>
              <CSelect
                label={kind === "tool" ? "Tools & equipment vendor" : "Supplier / vendor"}
                value={form.supplierId}
                onChange={(v) => setForm({ ...form, supplierId: v })}
                options={workers
                  .filter(
                    (w) =>
                      isActive(w.status) &&
                      (kind === "tool"
                        ? w.kind === "tool_vendor"
                        : w.kind !== "tool_vendor"),
                  )
                  .map((w) => ({ value: w.id, label: w.name }))}
                placeholder={
                  kind === "tool"
                    ? "Select tools & equipment vendor"
                    : "Select supplier / vendor"
                }
              />
              {!form.supplierId ? (
                <CField
                  label="…or type the supplier name"
                  value={form.supplier}
                  onChange={(v) => setForm({ ...form, supplier: v })}
                  placeholder={kind === "tool" ? "Add vendors in Workers & Vendors" : "If not in the master list"}
                />
              ) : (
                <div className="field" />
              )}
            </>
          )}
          <CField
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
          />
          <CField
            label="Invoice / bill no."
            value={form.invoiceNo}
            onChange={(v) => setForm({ ...form, invoiceNo: v })}
          />

          {kind === "gold" && (
            <>
              <CField
                label="Weight (g)"
                type="number"
                step="0.001"
                required
                value={form.weight}
                onChange={(v) => upd({ weight: v })}
              />
              <CSelect
                label="Purity"
                value={form.purity}
                onChange={(v) => setForm({ ...form, purity: v })}
                options={PURITIES}
              />
              <CField
                label="Rate per gram"
                type="number"
                value={form.rate}
                onChange={(v) => upd({ rate: v })}
              />
              {amountField}
            </>
          )}

          {kind === "jewellery" && (
            <>
              <div className="line-items">
                {form.pieces.map((p, i) => (
                  <div className="line-row buy-pieces" key={i}>
                    <CField
                      label={i === 0 ? "Piece name" : ""}
                      value={p.name}
                      onChange={(v) => setPiece(i, "name", v)}
                      placeholder="Chain 24 inch"
                    />
                    <CField
                      label={i === 0 ? "Product" : ""}
                      value={p.product}
                      onChange={(v) => setPiece(i, "product", v)}
                      placeholder="Chain, Ring"
                    />
                    <CField
                      label={i === 0 ? "Gross (g)" : ""}
                      type="number"
                      step="0.001"
                      required
                      value={p.grossWeight}
                      onChange={(v) => setPiece(i, "grossWeight", v)}
                    />
                    <CField
                      label={i === 0 ? "Stone (g)" : ""}
                      type="number"
                      step="0.001"
                      value={p.stoneWeight}
                      onChange={(v) => setPiece(i, "stoneWeight", v)}
                    />
                    <CSelect
                      label={i === 0 ? "Purity" : ""}
                      value={p.purity}
                      onChange={(v) => setPiece(i, "purity", v)}
                      options={PURITIES}
                    />
                    <button
                      type="button"
                      className="icon-square danger"
                      disabled={form.pieces.length === 1}
                      onClick={() =>
                        upd({ pieces: form.pieces.filter((_, n) => n !== i) })
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
                    upd({ pieces: [...form.pieces, blankPiece()] })
                  }
                >
                  <Plus size={13} /> Add piece
                </button>
              </div>
              <CField
                label="Stored at (location)"
                value={form.location}
                onChange={(v) => setForm({ ...form, location: v })}
              />
              <CField
                label="Rate per gram (optional)"
                type="number"
                value={form.rate}
                onChange={(v) => upd({ rate: v })}
              />
              {amountField}
              <div className="calc-box">
                <div>
                  <span>Pieces</span>
                  <strong>{form.pieces.length}</strong>
                </div>
                <div>
                  <span>Net weight</span>
                  <strong>{wt(jewelWeight)}</strong>
                </div>
              </div>
            </>
          )}

          {kind === "tool" && (
            <>
              <CField
                label="Tool / equipment *"
                required
                full
                value={form.itemName}
                onChange={(v) => setForm({ ...form, itemName: v })}
                placeholder="e.g. Melting furnace, Rolling machine"
              />
              <CField
                label="Size / model"
                value={form.size}
                onChange={(v) => setForm({ ...form, size: v })}
                placeholder="e.g. 5 kg, 12 inch"
              />
              <CField
                label="Quantity"
                type="number"
                required
                value={form.quantity}
                onChange={(v) => upd({ quantity: v })}
              />
              <CField
                label="Price per unit (₹)"
                type="number"
                step="0.01"
                value={form.rate}
                onChange={(v) => upd({ rate: v })}
              />
              {amountField}
            </>
          )}
          <CField
            label="Notes"
            full
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
          />
        </Drawer>
      )}
    </div>
  );
}