import { useState } from "react";
import { Printer, Receipt, Search, Wallet, Ban, Pencil, Calculator } from "lucide-react";
import toast from "react-hot-toast";
import { jobsApi, paymentsApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { run, usePaged, useMasters } from "../../hooks";
import { Badge, CField, CSelect, Drawer, EmptyRow, Stat, Tabs, ActionBtn } from "../../components/MasterUI";
import {
  dt,
  isActive,
  money,
  today,
  wt,
} from "../../components/masterHelpers";
import PrintDoc from "../../components/PrintDoc";
import Pagination from "../../components/Pagination";
import TaxPicker from "../../components/TaxPicker";
import Breadcrumb from "../../components/Breadcrumb";
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
  // both tabs are paginated by the backend; the summary cards come from the jobs response
  const jobs = usePaged(
    (p) =>
      jobsApi.page({
        owner: "customer",
        exclude: "cancelled",
        billing: "1",
        ...p,
      }),
    [],
  );
  const pays = usePaged((p) => paymentsApi.page(p), []);
  const cur = tab === "jobs" ? jobs : pays; // the table that is on screen
  const [charge, setCharge] = useState(null);
  const [pay, setPay] = useState(null);
  const [doc, setDoc] = useState(null); // { type, data }
  const [saving, setSaving] = useState(false);
  const reloadAll = () => {
    jobs.reload();
    pays.reload();
  };

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
      offerType: j.offerType || "amount",
      offerValue: j.offerValue || "",
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

  const offerTyped = Number(charge?.offerValue) || 0;
  const offer = charge
    ? Math.min(
        charge.offerType === "percent"
          ? Math.round(making * offerTyped) / 100
          : offerTyped,
        making,
      )
    : 0;
  const taxable = making - offer;

  const taxLines = charge
    ? taxRates
        .filter((t) => charge.taxRates.includes(t.id))
        .map((t) => ({
          name: t.name,
          rate: t.rate,
          amount: Math.round(taxable * t.rate) / 100,
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
        offerType: charge.offerType,
        offerValue: Number(charge.offerValue) || 0,
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

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <Breadcrumb />
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
          loading={!jobs.summary}
          value={jobs.summary?.invoices ?? 0}
          label="Invoices"
        />
        <Stat
          icon={Receipt}
          loading={!jobs.summary}
          value={money(jobs.summary?.billed)}
          label="Billed (incl. GST)"
        />
        <Stat
          icon={Wallet}
          loading={!jobs.summary}
          value={money(jobs.summary?.paid)}
          label="Received"
        />
        <Stat
          icon={Wallet}
          loading={!jobs.summary}
          value={money(jobs.summary?.outstanding)}
          label="Outstanding"
        />
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
              value={cur.q}
              onChange={(e) => {
                jobs.setQ(e.target.value); // one search box for both tabs
                pays.setQ(e.target.value);
              }}
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
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.rows.length === 0 && (
                  <EmptyRow
                    colSpan={10}
                    loading={jobs.loading}
                    rows={jobs.limit}
                  />
                )}
                {jobs.rows.map((j) => (
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
                      {j.offerAmount > 0 && (
                        <span className="sub">Offer − {money(j.offerAmount)}</span>
                      )}
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
                      {can("billing-manage") &&
                      j.invoiceNo &&
                      j.balance > 0.004 ? (
                        <ActionBtn
                          icon={Wallet}
                          label="Add payment"
                          onClick={() =>
                            setPay({
                                  job: j,
                                  amount: j.balance,
                                  mode: "cash",
                                  date: today(),
                                  notes: "",
                                })
                          }
                        />
                      ) : (
                        <span className="sub" style={{ margin: 0 }}>
                          {j.invoiceNo ? "Settled" : "—"}
                        </span>
                      )}
                    </td>
                    <td>
                      <div
                        className="action-buttons"
                        style={{ flexWrap: "wrap" }}
                      >
                        {can("billing-manage") && (
                          <ActionBtn icon={j.invoiceNo ? Pencil : Calculator} label={j.invoiceNo ? "Edit charge" : "Set making charge"} onClick={() => openCharge(j)} />
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
                {pays.rows.length === 0 && (
                  <EmptyRow
                    colSpan={7}
                    loading={pays.loading}
                    rows={pays.limit}
                  />
                )}
                {pays.rows.map((p) => (
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
                          <ActionBtn icon={Ban} label="Void payment" tone="danger" onClick={() => voidPay(p)} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination
          meta={cur.meta}
          loading={cur.loading}
          limit={cur.limit}
          onPage={cur.setPage}
          onLimit={cur.setLimit}
          label={tab === "jobs" ? "jobs" : "receipts"}
        />
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
          <CSelect
            label="Offer / discount (optional)"
            value={charge.offerType}
            onChange={(v) => setCharge({ ...charge, offerType: v })}
            options={[
              { value: "amount", label: "Amount (₹)" },
              { value: "percent", label: "Percentage (%)" },
            ]}
          />
          <CField
            label={
              charge.offerType === "percent" ? "Offer percentage (%)" : "Offer amount (₹)"
            }
            type="number"
            step="0.01"
            value={charge.offerValue}
            onChange={(v) => setCharge({ ...charge, offerValue: v })}
            placeholder="0"
          />
          <div className="calc-box">
            <div>
              <span>Weight used</span>
              <strong>{wt(basis)}</strong>
            </div>
            <div>
              <span>Making charge</span>
              <strong>{money(making)}</strong>
            </div>
            {offer > 0 && (
              <>
                <div>
                  <span>
                    Offer
                    {charge.offerType === "percent" ? ` ${offerTyped}%` : ""}
                  </span>
                  <strong>− {money(offer)}</strong>
                </div>
                <div>
                  <span>Taxable value</span>
                  <strong>{money(taxable)}</strong>
                </div>
              </>
            )}
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
              <strong>{money(taxable + taxTotal)}</strong>
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
