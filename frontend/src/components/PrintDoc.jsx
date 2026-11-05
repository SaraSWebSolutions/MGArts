import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { jobsApi, settingsApi } from "../services/endpoints";
import { dt, karat, money, wt } from "./masterHelpers";
import "../pages/client/Masters.css";

const Head = ({ s, title, no, date }) => (
  <>
    <header>
      <img src={s?.logo || "/assets/logo-horizontal.jpg"} alt={s?.shopName || "MG Arts"} />
      <div className="shop">
        <strong>{s?.shopName || "MG ARTS"}</strong>
        {s?.address && <div>{s.address}</div>}
        {s?.phone && <div>Ph: {s.phone}</div>}
        {s?.gstin && <div>GSTIN: {s.gstin}</div>}
      </div>
    </header>
    <h2>{title}</h2>
    <div className="print-meta">
      <div>
        <b>Document No</b>
        {no}
      </div>
      <div>
        <b>Date</b>
        {dt(date)}
      </div>
    </div>
  </>
);
const Meta = ({ rows }) => (
  <div className="print-meta">
    {rows.filter(Boolean).map(([k, v]) => (
      <div key={k}>
        <b>{k}</b>
        {v}
      </div>
    ))}
  </div>
);
const Sign = ({ left, right }) => (
  <div className="print-sign">
    <span>{left}</span>
    <span>{right}</span>
  </div>
);

function WorkerReceipt({ d, s }) {
  const fine = (d.issuedWeight * d.issuedPurity) / 1000;
  return (
    <>
      <Head
        s={s}
        title="WORKER RECEIPT"
        no={d.workerReceiptNo || d.jobNo}
        date={d.date}
      />
      <Meta
        rows={[
          ["Job No", d.jobNo],
          ["Customer", d.customer?.name],
          ["Mobile", d.customer?.mobile],
          ["Worker / Vendor", d.worker?.name],
          ["Product", d.product || "—"],
          ["Status", d.status],
        ]}
      />
      <table>
        <thead>
          <tr>
            <th>Particulars</th>
            <th className="r">Weight</th>
            <th className="r">Purity</th>
            <th className="r">Fine gold</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Customer gold issued to worker for jewellery making</td>
            <td className="r">{wt(d.issuedWeight)}</td>
            <td className="r">
              {karat(d.issuedPurity)} · {d.issuedPurity}
            </td>
            <td className="r">{wt(fine)}</td>
          </tr>
          {d.status === "completed" && (
            <>
              <tr>
                <td>Finished jewellery received from worker</td>
                <td className="r">{wt(d.finishedWeight)}</td>
                <td className="r">{d.issuedPurity}</td>
                <td className="r">
                  {wt((d.finishedWeight * d.issuedPurity) / 1000)}
                </td>
              </tr>
              <tr>
                <td>Scrap / filings returned</td>
                <td className="r">{wt(d.scrapWeight)}</td>
                <td className="r">{d.issuedPurity}</td>
                <td className="r">
                  {wt((d.scrapWeight * d.issuedPurity) / 1000)}
                </td>
              </tr>
              <tr>
                <td>Wastage</td>
                <td className="r">{wt(d.wastage)}</td>
                <td className="r">—</td>
                <td className="r">—</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
      {d.pieces?.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Piece</th>
              <th>Product</th>
              <th className="r">Gross</th>
              <th className="r">Stone / other</th>
              <th className="r">Net</th>
              <th className="r">Purity</th>
            </tr>
          </thead>
          <tbody>
            {d.pieces.map((p, i) => (
              <tr key={i}>
                <td>{p.name}</td>
                <td>{p.product}</td>
                <td className="r">{wt(p.grossWeight || p.weight)}</td>
                <td className="r">{wt(p.stoneWeight || 0)}</td>
                <td className="r">{wt(p.weight)}</td>
                <td className="r">
                  {karat(p.purity || d.issuedPurity)} ·{" "}
                  {p.purity || d.issuedPurity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Sign left="Customer signature" right="For MG Arts" />
    </>
  );
}

/** tax lines exactly as chosen on the bill (bills made earlier show one GST line) */
const taxList = (d) =>
  d.taxes?.length
    ? d.taxes
    : d.gstRate > 0
      ? [{ name: "GST", rate: d.gstRate, amount: d.gstAmount }]
      : [];

function Invoice({ d, s }) {
  return (
    <>
      <Head
        s={s}
        title="TAX INVOICE – MAKING CHARGES"
        no={d.invoiceNo}
        date={d.invoiceDate}
      />
      <Meta
        rows={[
          ["Bill to", d.customer?.name],
          ["Customer GSTIN", d.customer?.gstin || "—"],
          ["Address", d.customer?.address || "—"],
          ["Job No", d.jobNo],
          ["SAC", s?.sacCode || "9988"],
          ["Place of supply", s?.state],
        ]}
      />
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th className="r">Weight</th>
            <th className="r">Rate</th>
            <th className="r">Taxable value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Jewellery making charges (job work) – {d.product || "jewellery"}
              <span className="sub">
                Customer-owned gold; only the making service is invoiced
              </span>
            </td>
            <td className="r">{wt(d.finishedWeight || d.issuedWeight)}</td>
            <td className="r">
              {d.makingChargeType === "per_gram"
                ? `${money(d.makingChargeValue)} / g`
                : "Fixed"}
            </td>
            <td className="r">{money(d.makingCharge)}</td>
          </tr>
        </tbody>
      </table>
      <div className="print-total">
        {d.offerAmount > 0 && (
          <>
            <div>
              <span>Making charge</span>
              <span>{money(d.makingCharge)}</span>
            </div>
            <div>
              <span>
                Less: Offer
                {d.offerType === "percent" ? ` (${d.offerValue}%)` : ""}
              </span>
              <span>− {money(d.offerAmount)}</span>
            </div>
          </>
        )}
        <div>
          <span>Taxable value</span>
          <span>{money(d.taxableValue || d.makingCharge)}</span>
        </div>
        {taxList(d).map((t, i) => (
          <div key={i}>
            <span>
              {t.name} @ {t.rate}%
            </span>
            <span>{money(t.amount)}</span>
          </div>
        ))}
        <div className="grand">
          <span>Total</span>
          <span>{money(d.totalCharge)}</span>
        </div>
        <div>
          <span>Paid</span>
          <span>{money(d.paid)}</span>
        </div>
        <div>
          <span>Balance due</span>
          <span>{money(d.balance)}</span>
        </div>
      </div>
      <Sign left="Customer signature" right="Authorised signatory" />
    </>
  );
}

function PaymentReceipt({ d, s, job }) {
  return (
    <>
      <Head s={s} title="PAYMENT RECEIPT" no={d.receiptNo} date={d.date} />
      <Meta
        rows={[
          ["Received from", d.customer?.name],
          ["Mobile", d.customer?.mobile],
          ["Against invoice", job?.invoiceNo || d.job?.invoiceNo],
          ["Job No", d.job?.jobNo],
          ["Payment mode", String(d.mode).toUpperCase()],
          ["Notes", d.notes],
        ]}
      />
      <table>
        <thead>
          <tr>
            <th>Particulars</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Making charges incl. GST received</td>
            <td className="r">{money(d.amount)}</td>
          </tr>
        </tbody>
      </table>
      {job && (
        <div className="print-total">
          <div>
            <span>Invoice total</span>
            <span>{money(job.totalCharge)}</span>
          </div>
          <div>
            <span>Total paid till date</span>
            <span>{money(job.paid)}</span>
          </div>
          <div className="grand">
            <span>Balance due</span>
            <span>{money(job.balance)}</span>
          </div>
        </div>
      )}
      <Sign left="Customer signature" right="Authorised signatory" />
    </>
  );
}

function SaleInvoice({ d, s }) {
  return (
    <>
      <Head
        s={s}
        title="TAX INVOICE – JEWELLERY SALE"
        no={d.invoiceNo}
        date={d.date}
      />
      <Meta
        rows={[
          ["Buyer", d.buyerName],
          ["Mobile", d.buyerMobile || "—"],
          ["Payment mode", String(d.mode).toUpperCase()],
        ]}
      />
      <table>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Item</th>
            <th className="r">Weight</th>
            <th className="r">Purity</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((i) => (
            <tr key={i.tag}>
              <td>{i.tag}</td>
              <td>{i.name}</td>
              <td className="r">{wt(i.weight)}</td>
              <td className="r">
                {karat(i.purity)} · {i.purity}
              </td>
              <td className="r">{money(i.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="print-total">
        <div>
          <span>Sub-total</span>
          <span>{money(d.subtotal)}</span>
        </div>
        {taxList(d).map((t, i) => (
          <div key={i}>
            <span>
              {t.name} @ {t.rate}%
            </span>
            <span>{money(t.amount)}</span>
          </div>
        ))}
        <div className="grand">
          <span>Total</span>
          <span>{money(d.total)}</span>
        </div>
      </div>
      <Sign left="Customer signature" right="For MG Arts" />
    </>
  );
}

function GoldReceipt({ d, s }) {
  return (
    <>
      <Head
        s={s}
        title="GOLD RECEIVED FROM CUSTOMER"
        no={d.receiptNo}
        date={d.date}
      />
      <Meta
        rows={[
          ["Customer", d.customer?.name],
          ["Mobile", d.customer?.mobile],
          ["Notes", d.notes],
        ]}
      />
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
            <th className="r">Weight</th>
            <th className="r">Purity</th>
            <th className="r">Fine gold</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((i, n) => (
            <tr key={n}>
              <td>{i.kind === "bar" ? "Gold bar" : "Old gold"}</td>
              <td>{i.description || "—"}</td>
              <td className="r">{wt(i.weight)}</td>
              <td className="r">
                {karat(i.purity)} · {i.purity}
              </td>
              <td className="r">{wt((i.weight * i.purity) / 1000)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>
              <b>Total</b>
            </td>
            <td className="r">
              <b>{wt(d.totalWeight)}</b>
            </td>
            <td />
            <td className="r">
              <b>{wt(d.fineWeight)}</b>
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="print-note">
        This gold is held in the customer's own stock and is kept separate from
        MG Arts' own stock.
      </p>
      <Sign left="Customer signature" right="For MG Arts" />
    </>
  );
}

/** type: worker-receipt | invoice | payment | sale | gold-receipt */
export default function PrintDoc({ type, data, onClose }) {
  const [s, setS] = useState(null);
  const [job, setJob] = useState(null);
  useEffect(() => {
    settingsApi
      .get()
      .then(setS)
      .catch(() => {});
    if (type === "payment" && data?.job?.id)
      jobsApi
        .get(data.job.id)
        .then(setJob)
        .catch(() => {});
  }, [type, data]);
  const body = {
    "worker-receipt": WorkerReceipt,
    invoice: Invoice,
    payment: PaymentReceipt,
    sale: SaleInvoice,
    "gold-receipt": GoldReceipt,
  }[type];
  const Body = body;
  return (
    <div
      className="modal-backdrop doc-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="doc-wrap">
        <div className="doc-actions">
          <button className="primary-btn" onClick={() => window.print()}>
            <Printer size={15} /> Print / Save PDF
          </button>
          <button className="secondary-btn" onClick={onClose}>
            <X size={14} /> Close
          </button>
        </div>
        <div className="print-sheet">
          <Body d={data} s={s} job={job} />
        </div>
      </div>
    </div>
  );
}
