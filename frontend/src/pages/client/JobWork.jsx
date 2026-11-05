import { useEffect, useState } from "react";
import { Hammer, PackageCheck, Plus, Printer, Scale, Search, Truck, Ban } from "lucide-react";
import toast from "react-hot-toast";
import { fetchData, jobsApi } from "../../services/endpoints";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { run, usePaged, useMasters } from "../../hooks";
import { Badge, CField, CSelect, Drawer, EmptyRow, Stat, Tabs, ActionBtn } from "../../components/MasterUI";
import Pagination from "../../components/Pagination";
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
import Breadcrumb from "../../components/Breadcrumb";
import "./Masters.css";

const STATUS = {
  issued: ["amber", "With worker"],
  completed: ["green", "Completed"],
  cancelled: ["grey", "Cancelled"],
};
const blankIssue = () => ({
  owner: "customer",
  customer: "",
  worker: "",
  issuedWeight: "",
  issuedPurity: "916",
  product: "",
  date: today(),
  notes: "",
});
const blankPiece = (purity = "916") => ({
  name: "",
  product: "",
  grossWeight: "",
  stoneWeight: "",
  purity: String(purity),
});

export default function JobWork() {
  const { can } = useAuth();
  const { customers, workers } = useMasters();
  const [f, setF] = useState({ owner: "", status: "" });
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
  } = usePaged((p) => jobsApi.page({ ...clean(f), ...p }), [f]);
  const [issue, setIssue] = useState(null);
  const [recv, setRecv] = useState(null); // { job, pieces, scrap, date, location }
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState(null);
  const [avail, setAvail] = useState(null);

  const key = issue
    ? `${issue.owner}|${issue.customer}|${issue.issuedPurity}`
    : "";
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

  const saveIssue = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await jobsApi.create({
        ...issue,
        customer: issue.owner === "customer" ? issue.customer : undefined,
        issuedWeight: Number(issue.issuedWeight),
        issuedPurity: Number(issue.issuedPurity),
      });
      toast.success("Gold issued to worker");
      setIssue(null);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to issue gold"));
    } finally {
      setSaving(false);
    }
  };

  const setPiece = (i, k, v) =>
    setRecv((p) => ({
      ...p,
      pieces: p.pieces.map((x, n) => (n === i ? { ...x, [k]: v } : x)),
    }));
  const net = (p) =>
    Math.max((Number(p.grossWeight) || 0) - (Number(p.stoneWeight) || 0), 0);
  const finished = recv ? recv.pieces.reduce((s, p) => s + net(p), 0) : 0;
  const wastage = recv
    ? recv.job.issuedWeight - finished - (Number(recv.scrap) || 0)
    : 0;

  const saveRecv = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await jobsApi.receive(recv.job.id, {
        pieces: recv.pieces.map((p) => ({
          ...p,
          grossWeight: Number(p.grossWeight),
          stoneWeight: Number(p.stoneWeight) || 0,
          purity: Number(p.purity),
        })),
        scrapWeight: Number(recv.scrap) || 0,
        date: recv.date,
        location: recv.location,
      });
      toast.success("Jewellery received");
      setRecv(null);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to receive jewellery"));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (j) => {
    if (
      window.confirm(`Cancel ${j.jobNo}? The gold returns to stock.`) &&
      (await run(() => jobsApi.cancel(j.id), "Job cancelled"))
    )
      reload();
  };
  const deliver = async (j) => {
    if (
      window.confirm(
        `Deliver the finished jewellery of ${j.jobNo} to ${j.customer?.name}?`,
      ) &&
      (await run(() => jobsApi.deliver(j.id), "Delivered to customer"))
    )
      reload();
  };

  return (
    <div className="master-page">
      <header className="master-head">
        <div>
          <Breadcrumb />
          <h1>Job Work</h1>
          <p>
            Issue customer or own gold to a worker, then receive the finished
            jewellery. Wastage is calculated automatically.
          </p>
        </div>
        {can("jobs-manage") && (
          <button
            className="primary-btn"
            onClick={() => {
              setAvail(null);
              setIssue(blankIssue());
            }}
          >
            <Plus size={16} /> Issue Gold
          </button>
        )}
      </header>
      <div className="master-stats">
        <Stat
          icon={Hammer}
          loading={!summary}
          value={summary?.total ?? 0}
          label="Jobs"
        />
        <Stat
          icon={Hammer}
          loading={!summary}
          value={summary?.issued ?? 0}
          label="With Workers"
        />
        <Stat
          icon={Scale}
          loading={!summary}
          value={wt(summary?.heldWeight)}
          label="Gold Held by Workers"
        />
        <Stat
          icon={PackageCheck}
          loading={!summary}
          value={summary?.completed ?? 0}
          label="Completed"
        />
      </div>
      <Tabs
        value={f.owner}
        onChange={(v) => setF({ ...f, owner: v })}
        items={[
          { value: "", label: "All jobs" },
          { value: "customer", label: "Customer gold" },
          { value: "own", label: "Own gold" },
        ]}
      />
      <section className="master-card">
        <div className="master-toolbar">
          <div className="master-search">
            <Search size={15} />
            <input
              placeholder="Search job, customer, worker..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <select
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value })}
            >
              <option value="">All status</option>
              <option value="issued">With worker</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="master-table-wrap">
          <table className="master-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Job</th>
                <th>Stock / customer</th>
                <th>Worker</th>
                <th className="num">Issued</th>
                <th className="num">Received</th>
                <th className="num">Wastage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={8} loading={loading} rows={limit} />
              )}
              {rows.map((j) => (
                <tr key={j.id}>
                  <td>
                    <div className="name-cell">
                      <span className="row-icon">
                        <Hammer size={16} />
                      </span>
                      <div>
                        <strong>{j.jobNo}</strong>
                        <small>
                          {dt(j.date)}
                          {j.product ? ` · ${j.product}` : ""}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={j.owner === "own" ? "amber" : "blue"}>
                      {j.owner === "own" ? "Own" : "Customer"}
                    </Badge>
                    <span className="sub">{j.customer?.name || ""}</span>
                  </td>
                  <td>{j.worker?.name}</td>
                  <td className="num">
                    {wt(j.issuedWeight)}
                    <span className="sub">
                      {karat(j.issuedPurity)} · {j.issuedPurity}
                    </span>
                  </td>
                  <td className="num">
                    {j.status === "completed" ? (
                      <>
                        {wt(j.finishedWeight)}
                        <span className="sub">+ scrap {wt(j.scrapWeight)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num">
                    {j.status === "completed" ? wt(j.wastage) : "—"}
                  </td>
                  <td>
                    <Badge tone={STATUS[j.status][0]}>
                      {STATUS[j.status][1]}
                    </Badge>
                    {j.delivered && (
                      <span className="sub">Delivered {dt(j.deliveredAt)}</span>
                    )}
                  </td>
                  <td>
                    <div
                      className="action-buttons"
                      style={{ flexWrap: "wrap" }}
                    >
                      {j.owner === "customer" && (
                        <button
                          className="icon-square"
                          title="Print worker receipt"
                          onClick={() => setDoc(j)}
                        >
                          <Printer size={14} />
                        </button>
                      )}
                      {can("jobs-manage") && j.status === "issued" && (
                        <ActionBtn icon={PackageCheck} label="Receive jewellery" onClick={() => setRecv({
                              job: j,
                              pieces: [blankPiece(j.issuedPurity)],
                              scrap: "",
                              date: today(),
                              location: "Shop",
                            })} />
                      )}
                      {can("jobs-manage") && j.status === "issued" && (
                        <ActionBtn icon={Ban} label="Cancel job" tone="danger" onClick={() => cancel(j)} />
                      )}
                      {can("jobs-manage") &&
                        j.owner === "customer" &&
                        j.status === "completed" &&
                        !j.delivered && (
                          <ActionBtn icon={Truck} label="Deliver to customer" onClick={() => deliver(j)} />
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
          label="jobs"
        />
      </section>

      {issue && (
        <Drawer
          title="Issue Gold to Worker"
          subtitle="Reduces the chosen stock"
          onClose={() => setIssue(null)}
          onSave={saveIssue}
          saving={saving}
          saveLabel="Issue Gold"
        >
          <CSelect
            label="Gold belongs to"
            required
            value={issue.owner}
            onChange={(v) => setIssue({ ...issue, owner: v })}
            options={[
              { value: "customer", label: "Customer (their stock)" },
              { value: "own", label: "Own stock" },
            ]}
          />
          <CField
            label="Date"
            type="date"
            required
            value={issue.date}
            onChange={(v) => setIssue({ ...issue, date: v })}
          />
          {issue.owner === "customer" && (
            <CSelect
              full
              label="Customer"
              required
              value={issue.customer}
              onChange={(v) => setIssue({ ...issue, customer: v })}
              options={opts(customers, (c) => `${c.name} (${c.code})`)}
              placeholder="Select customer"
            />
          )}
          <CSelect
            full
            label="Worker / vendor"
            required
            value={issue.worker}
            onChange={(v) => setIssue({ ...issue, worker: v })}
            options={opts(workers.filter((w) => w.kind !== "tool_vendor"))}
            placeholder="Select worker"
          />
          <CSelect
            label="Gold purity"
            value={issue.issuedPurity}
            onChange={(v) => setIssue({ ...issue, issuedPurity: v })}
            options={PURITIES}
          />
          <CField
            label="Weight to issue (g)"
            type="number"
            step="0.001"
            required
            value={issue.issuedWeight}
            onChange={(v) => setIssue({ ...issue, issuedWeight: v })}
          />
          {avail !== null && (
            <div
              className={
                Number(issue.issuedWeight) > avail ? "warn-box" : "master-note"
              }
            >
              Available at {issue.issuedPurity}: <b>{wt(avail)}</b>
              {Number(issue.issuedWeight) > avail &&
                " - not enough stock. Convert or receive more gold first."}
            </div>
          )}
          <CField
            label="Product / design"
            full
            value={issue.product}
            onChange={(v) => setIssue({ ...issue, product: v })}
            placeholder="e.g. chain, bangles"
          />
          <CField
            label="Notes"
            full
            value={issue.notes}
            onChange={(v) => setIssue({ ...issue, notes: v })}
          />
        </Drawer>
      )}

      {recv && (
        <Drawer
          wide
          title={`Receive Jewellery · ${recv.job.jobNo}`}
          subtitle={`Issued ${wt(recv.job.issuedWeight)} to ${recv.job.worker?.name}`}
          onClose={() => setRecv(null)}
          onSave={saveRecv}
          saving={saving}
          saveLabel="Receive"
        >
          <div className="line-items">
            {recv.pieces.map((p, i) => (
              <div className="line-row pieces" key={i}>
                <CField
                  label={i === 0 ? "Piece name" : ""}
                  value={p.name}
                  onChange={(v) => setPiece(i, "name", v)}
                  placeholder="e.g. Chain 24 inch"
                />
                <CField
                  label={i === 0 ? "Product" : ""}
                  value={p.product}
                  onChange={(v) => setPiece(i, "product", v)}
                  placeholder="Chain / Ring..."
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
                  label={i === 0 ? "Stone / other (g)" : ""}
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
                  disabled={recv.pieces.length === 1}
                  onClick={() =>
                    setRecv({
                      ...recv,
                      pieces: recv.pieces.filter((_, n) => n !== i),
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
                setRecv({
                  ...recv,
                  pieces: [...recv.pieces, blankPiece(recv.job.issuedPurity)],
                })
              }
            >
              <Plus size={13} /> Add piece
            </button>
          </div>
          <CField
            label="Scrap / filings returned (g)"
            type="number"
            step="0.001"
            value={recv.scrap}
            onChange={(v) => setRecv({ ...recv, scrap: v })}
          />
          <CField
            label="Received date"
            type="date"
            required
            value={recv.date}
            onChange={(v) => setRecv({ ...recv, date: v })}
          />
          <CField
            label="Location"
            full
            value={recv.location}
            onChange={(v) => setRecv({ ...recv, location: v })}
          />
          <div className="master-note" style={{ gridColumn: "1/-1" }}>
            Net gold weight = Gross − Stone / other. Stock and wastage use the
            net weight.
          </div>
          <div className="calc-box">
            <div>
              <span>Issued</span>
              <strong>{wt(recv.job.issuedWeight)}</strong>
            </div>
            <div>
              <span>Jewellery (net)</span>
              <strong>{wt(finished)}</strong>
            </div>
            <div>
              <span>Wastage</span>
              <strong>{wt(Math.max(wastage, 0))}</strong>
            </div>
            <div>
              <span>Wastage %</span>
              <strong>
                {recv.job.issuedWeight
                  ? (
                      (Math.max(wastage, 0) / recv.job.issuedWeight) *
                      100
                    ).toFixed(2)
                  : 0}
                %
              </strong>
            </div>
          </div>
          {wastage < -0.0005 && (
            <div className="warn-box">
              Received weight is more than the issued weight.
            </div>
          )}
        </Drawer>
      )}
      {doc && (
        <PrintDoc
          type="worker-receipt"
          data={doc}
          onClose={() => setDoc(null)}
        />
      )}
    </div>
  );
}
