import { useState } from "react";
import { Printer, Receipt, Search, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { jobsApi, paymentsApi } from "../../services/endpoints";
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
  Tabs,
} from "../../components/MasterUI";
import {
  dt,
  isActive,
  money,
  today,
  wt,
} from "../../components/masterHelpers";
import PrintDoc from "../../components/PrintDoc";
import TaxPicker from "../../components/TaxPicker";
import "./Masters.css";

const PAY = {
  not_billed: ["grey", "Not billed"],
  unpaid: ["red", "Unpaid"],
  partial: ["amber", "Part paid"],
  paid: ["green", "Paid"],
};
const MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export default function Billing() {
  const { can } = useAuth();
  const { taxRates } = useMasters();
  const [tab, setTab] = useState("jobs");
  const jobs = useList(() => jobsApi.list({ owner: "customer" }), []);
  const pays = useList(() => paymentsApi.list(), []);
  const [charge, setCharge] = useState(null);
  const [pay, setPay] = useState(null);
  const [doc, setDoc] = useState(null); // { type, data }
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const reloadAll = () => {
    jobs.reload();
    pays.reload();
  };

  const list = jobs.rows.filter((j) => j.status !== "cancelled");
  const billed = list.reduce((s, j) => s + (j.totalCharge || 0), 0);
  const paid = list.reduce((s, j) => s + (j.paid || 0), 0);

  const openCharge = (j) => {
    const saved = j.taxes?.length
      ? j.taxes.map((t) => String(t.taxRate))
      : j.taxRate?.id
        ? [j.taxRate.id]
        : taxRates
            .filter((t) => t.type === "making" && t.isDefault && isActive(t.status))
            .map((t) => t.id);
    setCharge({
      job: j,
      makingChargeType: j.makingChargeType || "per_gram",
      makingChargeValue: j.makingChargeValue || "",
      taxRates: saved,
    });
  };
  const basis = charge
    ? charge.job.finishedWeight || charge.job.issuedWeight
    : 0;
  const making = charge
    ? charge.makingChargeType === "per_gram"
      ? (Number(charge.makingChargeValue) || 0) * basis
      : Number(charge.makingChargeValue) || 0
    : 0;

  const taxLines = charge
    ? taxRates
        .filter((t) => charge.taxRates.includes(t.id))
        .map((t) => ({
          name: t.name,
          rate: t.rate,
          amount: Math.round(making * t.rate) / 100,
        }))
    : [];
  const taxTotal = taxLines.reduce((s, t) => s + t.amount, 0);

  const saveCharge = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await jobsApi.setCharges(charge.job.id, {
        makingChargeType: charge.makingChargeType,
        makingChargeValue: Number(charge.makingChargeValue),
        taxRates: charge.taxRates,
      });
      toast.success("Making charge saved");
      setCharge(null);
      reloadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save charge"));
    } finally {
      setSaving(false);
    }
  };
  const savePay = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await paymentsApi.create({
        job: pay.job.id,
        amount: Number(pay.amount),
        mode: pay.mode,
        date: pay.date,
        notes: pay.notes,
      });
      toast.success("Payment recorded");
      setPay(null);
      reloadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to record payment"));
    } finally {
      setSaving(false);
    }
  };
  const voidPay = async (p) => {
    if (
      window.confirm(`Void ${p.receiptNo}?`) &&
      (await run(() => paymentsApi.void(p.id), "Payment voided"))
    )
      reloadAll();
  };

  const shownJobs = list.filter((j) =>
    `${j.jobNo}${j.invoiceNo}${j.customer?.name}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const shownPays = pays.rows.filter((p) =>
    `${p.receiptNo}${p.customer?.name}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <span className="master-eyebrow">TRANSACTIONS / BILLING</span>
          <h1>Billing & Payments</h1>
          <p>
            Customers pay only the making charge (plus GST). Set the charge per
            job, print the GST invoice and record payments.
          </p>
        </div>
      </header>
      <div className="master-stats">
        <Stat
          icon={Receipt}
          value={list.filter((j) => j.invoiceNo).length}
          label="Invoices"
        />
        <Stat icon={Receipt} value={money(billed)} label="Billed (incl. GST)" />
        <Stat icon={Wallet} value={money(paid)} label="Received" />
        <Stat icon={Wallet} value={money(billed - paid)} label="Outstanding" />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "jobs", label: "Customer jobs" },
          { value: "payments", label: "Payment receipts" },
        ]}
      />
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
        </div>
        <div className="master-table-wrap">
          {tab === "jobs" ? (
            <table className="master-table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th>Job / invoice</th>
                  <th>Customer</th>
                  <th className="num">Weight</th>
                  <th className="num">Making</th>
                  <th className="num">GST</th>
                  <th className="num">Total</th>
                  <th className="num">Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shownJobs.length === 0 && (
                  <EmptyRow colSpan={9} loading={jobs.loading} />
                )}
                {shownJobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <div className="name-cell">
                        <span className="row-icon">
                          <Receipt size={16} />
                        </span>
                        <div>
                          <strong>{j.jobNo}</strong>
                          <small>{j.invoiceNo || "No invoice yet"}</small>
                        </div>
                      </div>
                    </td>
                    <td>{j.customer?.name}</td>
                    <td className="num">
                      {wt(j.finishedWeight || j.issuedWeight)}
                    </td>
                    <td className="num">
                      {j.invoiceNo ? money(j.makingCharge) : "—"}
                    </td>
                    <td className="num">
                      {j.invoiceNo ? (
                        <>
                          {money(j.gstAmount)}
                          <span className="sub">
                            {j.taxes?.length
                              ? j.taxes.map((t) => `${t.name} ${t.rate}%`).join(" + ")
                              : `${j.gstRate}%`}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num">
                      {j.invoiceNo ? money(j.totalCharge) : "—"}
                    </td>
                    <td className="num">
                      {j.invoiceNo ? money(j.balance) : "—"}
                    </td>
                    <td>
                      <Badge tone={PAY[j.paymentStatus][0]}>
                        {PAY[j.paymentStatus][1]}
                      </Badge>
                    </td>
                    <td>
                      <div
                        className="action-buttons"
                        style={{ flexWrap: "wrap" }}
                      >
                        {can("billing-manage") && (
                          <button
                            className="act-text"
                            onClick={() => openCharge(j)}
                          >
                            {j.invoiceNo ? "Edit charge" : "Set charge"}
                          </button>
                        )}
                        {can("billing-manage") &&
                          j.invoiceNo &&
                          j.balance > 0.004 && (
                            <button
                              className="act-text"
                              onClick={() =>
                                setPay({
                                  job: j,
                                  amount: j.balance,
                                  mode: "cash",
                                  date: today(),
                                  notes: "",
                                })
                              }
                            >
                              + Payment
                            </button>
                          )}
                        {j.invoiceNo && (
                          <button
                            className="icon-square"
                            title="Print GST invoice"
                            onClick={() => setDoc({ type: "invoice", data: j })}
                          >
                            <Printer size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="master-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Customer</th>
                  <th>Invoice</th>
                  <th>Mode</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shownPays.length === 0 && (
                  <EmptyRow colSpan={7} loading={pays.loading} />
                )}
                {shownPays.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="name-cell">
                        <span className="row-icon">
                          <Wallet size={16} />
                        </span>
                        <div>
                          <strong>{p.receiptNo}</strong>
                          <small>{dt(p.date)}</small>
                        </div>
                      </div>
                    </td>
                    <td>{p.customer?.name}</td>
                    <td>
                      {p.job?.invoiceNo}
                      <span className="sub">{p.job?.jobNo}</span>
                    </td>
                    <td>{String(p.mode).toUpperCase()}</td>
                    <td className="num">{money(p.amount)}</td>
                    <td>
                      {p.status === "void" ? (
                        <Badge tone="grey">Void</Badge>
                      ) : (
                        <Badge tone="green">Received</Badge>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="icon-square"
                          title="Print receipt"
                          onClick={() => setDoc({ type: "payment", data: p })}
                        >
                          <Printer size={14} />
                        </button>
                        {can("billing-manage") && p.status === "active" && (
                          <button
                            className="act-text red"
                            onClick={() => voidPay(p)}
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="master-footer">
          {tab === "jobs" ? shownJobs.length : shownPays.length} records
        </div>
      </section>

      {charge && (
        <Drawer
          title={`Making Charge · ${charge.job.jobNo}`}
          subtitle={charge.job.customer?.name}
          onClose={() => setCharge(null)}
          onSave={saveCharge}
          saving={saving}
          saveLabel="Save Charge"
        >
          <CSelect
            label="Charge type"
            value={charge.makingChargeType}
            onChange={(v) => setCharge({ ...charge, makingChargeType: v })}
            options={[
              { value: "per_gram", label: "Per gram" },
              { value: "fixed", label: "Fixed amount" },
            ]}
          />
          <CField
            label={
              charge.makingChargeType === "per_gram"
                ? "Rate per gram (₹)"
                : "Amount (₹)"
            }
            type="number"
            step="0.01"
            required
            value={charge.makingChargeValue}
            onChange={(v) => setCharge({ ...charge, makingChargeValue: v })}
          />
          <TaxPicker
            label="Taxes on this bill *"
            taxes={taxRates.filter(
              (t) => t.type !== "sale" && (isActive(t.status) || charge.taxRates.includes(t.id)),
            )}
            value={charge.taxRates}
            onChange={(v) => setCharge({ ...charge, taxRates: v })}
          />
          <div className="calc-box">
            <div>
              <span>Weight used</span>
              <strong>{wt(basis)}</strong>
            </div>
            <div>
              <span>Making</span>
              <strong>{money(making)}</strong>
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
              <strong>{money(making + taxTotal)}</strong>
            </div>
          </div>
          {!charge.job.finishedWeight && (
            <div className="master-note">
              Jewellery is not received yet - per-gram charge uses the issued
              weight and is recalculated when jewellery is received.
            </div>
          )}
        </Drawer>
      )}
      {pay && (
        <Drawer
          title={`Record Payment · ${pay.job.invoiceNo}`}
          subtitle={`Balance due ${money(pay.job.balance)}`}
          onClose={() => setPay(null)}
          onSave={savePay}
          saving={saving}
          saveLabel="Save Payment"
        >
          <CField
            label="Amount (₹)"
            type="number"
            step="0.01"
            required
            value={pay.amount}
            onChange={(v) => setPay({ ...pay, amount: v })}
          />
          <CSelect
            label="Mode"
            value={pay.mode}
            onChange={(v) => setPay({ ...pay, mode: v })}
            options={MODES}
          />
          <CField
            label="Date"
            type="date"
            required
            value={pay.date}
            onChange={(v) => setPay({ ...pay, date: v })}
          />
          <CField
            label="Notes"
            value={pay.notes}
            onChange={(v) => setPay({ ...pay, notes: v })}
          />
        </Drawer>
      )}
      {doc && (
        <PrintDoc
          type={doc.type}
          data={doc.data}
          onClose={() => setDoc(null)}
        />
      )}
    </div>
  );
}
