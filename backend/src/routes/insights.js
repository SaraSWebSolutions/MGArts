import { Router } from "express";
import {
  Customer,
  Job,
  Jewellery,
  Ledger,
  Payment,
  Purchase,
  Sale,
  Worker,
} from "../models.js";
import { auth, can } from "../auth.js";
import { h, isId, listPage, oid, pageRows, r2, r3 } from "../utils.js";
import { balanceRows } from "../stock.js";

const router = Router();
router.use(auth);

const dateMatch = (q) => {
  const m = {};
  if (q.from) m.$gte = new Date(q.from);
  if (q.to) {
    const t = new Date(q.to);
    t.setHours(23, 59, 59, 999);
    m.$lte = t;
  }
  return m;
};
const names = async () => {
  const [c, w] = await Promise.all([Customer.find(), Worker.find()]);
  return {
    cust: Object.fromEntries(c.map((x) => [String(x._id), x])),
    work: Object.fromEntries(w.map((x) => [String(x._id), x])),
  };
};

/* ---------- stock balances (own vs customer, separately) ---------- */
router.get(
  "/stock/balances",
  can("stock-view", "reports-view"),
  h(async (req, res) => {
    const match = {};
    if (["own", "customer"].includes(req.query.owner))
      match.owner = req.query.owner;
    if (isId(req.query.customer)) match.customer = oid(req.query.customer);
    if (["gold", "jewellery"].includes(req.query.item))
      match.item = req.query.item;
    const { cust } = await names();
    const rows = (await balanceRows(match)).map((r) => ({
      ...r,
      customerName: r.customer ? cust[String(r.customer)]?.name || "—" : null,
      customer: r.customer ? String(r.customer) : null,
    }));
    rows.sort(
      (a, b) =>
        a.owner.localeCompare(b.owner) ||
        String(a.customerName).localeCompare(String(b.customerName)) ||
        a.item.localeCompare(b.item) ||
        b.purity - a.purity,
    );
    res.json({ data: rows });
  }),
);

/* ---------- ledger with opening / receipts / issues / closing ---------- */
router.get(
  "/stock/ledger",
  can("stock-view", "reports-view"),
  h(async (req, res) => {
    const q = req.query;
    const base = {};
    if (["own", "customer"].includes(q.owner)) base.owner = q.owner;
    if (isId(q.customer)) base.customer = q.customer;
    if (["gold", "jewellery"].includes(q.item)) base.item = q.item;
    if (q.txnType) base.txnType = q.txnType;
    const range = dateMatch(q);
    const page = await listPage(
      Ledger,
      {
        ...base,
        ...(Object.keys(range).length ? { date: range } : {}),
      },
      req,
      {
        sort: { date: -1, createdAt: -1 },
        decorate: (qr) =>
          qr.populate("customer", "name code").populate("worker", "name"),
        legacyLimit: Math.min(Number(q.limit) || 300, 1000),
      },
    );

    const agg = (extra) =>
      Ledger.aggregate([
        {
          $match: {
            ...Object.fromEntries(
              Object.entries(base).map(([k, v]) => [
                k,
                k === "customer" ? oid(v) : v,
              ]),
            ),
            ...extra,
          },
        },
        {
          $group: {
            _id: "$item",
            inW: {
              $sum: { $cond: [{ $eq: ["$direction", "in"] }, "$weight", 0] },
            },
            outW: {
              $sum: { $cond: [{ $eq: ["$direction", "out"] }, "$weight", 0] },
            },
          },
        },
      ]);
    const [before, within] = await Promise.all([
      q.from ? agg({ date: { $lt: new Date(q.from) } }) : [],
      agg(Object.keys(range).length ? { date: range } : {}),
    ]);
    const baseMatch = Object.fromEntries(
      Object.entries(base).map(([k, v]) => [k, k === "customer" ? oid(v) : v]),
    );
    const byType = (
      await Ledger.aggregate([
        {
          $match: {
            ...baseMatch,
            ...(Object.keys(range).length ? { date: range } : {}),
          },
        },
        {
          $group: {
            _id: { txnType: "$txnType", direction: "$direction" },
            weight: { $sum: "$weight" },
          },
        },
      ])
    ).map((x) => ({
      txnType: x._id.txnType,
      direction: x._id.direction,
      weight: r3(x.weight),
    }));
    const summary = { byType };
    for (const item of ["gold", "jewellery"]) {
      const b = before.find((x) => x._id === item);
      const w = within.find((x) => x._id === item);
      const opening = r3((b?.inW || 0) - (b?.outW || 0));
      const inW = r3(w?.inW || 0);
      const outW = r3(w?.outW || 0);
      summary[item] = {
        opening,
        in: inW,
        out: outW,
        closing: r3(opening + inW - outW),
      };
    }
    res.json({ data: page.data, meta: page.meta, summary });
  }),
);

/* ---------- reports ---------- */
/** totals are always for the whole result; rows are paged (?page=&limit=) - ?all=1 returns every row (CSV export) */
const report = (req, columns, rows, totals) => {
  const pg = pageRows(rows, req.query);
  return {
    data: { columns, rows: pg.rows, totals: totals || null },
    ...(pg.meta ? { meta: pg.meta } : {}),
  };
};

router.get(
  "/reports/reconciliation",
  can("reports-view"),
  h(async (req, res) => {
    const f = { status: { $ne: "cancelled" } };
    if (["own", "customer"].includes(req.query.owner))
      f.owner = req.query.owner;
    if (isId(req.query.worker)) f.worker = req.query.worker;
    const range = dateMatch(req.query);
    if (Object.keys(range).length) f.date = range;
    const jobs = await Job.find(f)
      .populate("customer", "name")
      .populate("worker", "name")
      .sort({ date: -1 });
    const rows = jobs.map((j) => ({
      id: j.id,
      jobNo: j.jobNo,
      date: j.date,
      owner: j.owner === "own" ? "Own" : "Customer",
      customer: j.customer?.name || "—",
      worker: j.worker?.name || "—",
      status: j.status,
      issued: j.issuedWeight,
      jewellery: j.finishedWeight,
      scrap: j.scrapWeight,
      wastage: j.status === "completed" ? j.wastage : 0,
      wastagePct:
        j.status === "completed" && j.issuedWeight
          ? r2((j.wastage / j.issuedWeight) * 100)
          : 0,
      withWorker: j.status === "issued" ? j.issuedWeight : 0,
    }));
    const sum = (k) => r3(rows.reduce((s, r) => s + (r[k] || 0), 0));
    res.json(
      report(
        req,
        [
          { key: "jobNo", label: "Job" },
          { key: "date", label: "Date", type: "date" },
          { key: "owner", label: "Stock" },
          { key: "customer", label: "Customer" },
          { key: "worker", label: "Worker" },
          { key: "status", label: "Status" },
          { key: "issued", label: "Issued (g)", type: "wt" },
          { key: "jewellery", label: "Jewellery (g)", type: "wt" },
          { key: "scrap", label: "Scrap (g)", type: "wt" },
          { key: "wastage", label: "Wastage (g)", type: "wt" },
          { key: "wastagePct", label: "Wastage %", type: "pct" },
          { key: "withWorker", label: "Still with worker (g)", type: "wt" },
        ],
        rows,
        {
          jobNo: "Total",
          issued: sum("issued"),
          jewellery: sum("jewellery"),
          scrap: sum("scrap"),
          wastage: sum("wastage"),
          withWorker: sum("withWorker"),
        },
      ),
    );
  }),
);

router.get(
  "/reports/customer-balance",
  can("reports-view"),
  h(async (req, res) => {
    const f = { owner: "customer" };
    if (isId(req.query.customer)) f.customer = req.query.customer;
    const [ledger, { cust }] = await Promise.all([Ledger.find(f), names()]);
    const by = {};
    for (const e of ledger) {
      const r = (by[e.customer] ||= {
        received: 0,
        converted: 0,
        issued: 0,
        scrap: 0,
        jewelleryMade: 0,
        delivered: 0,
        goldBalance: 0,
        jewelleryBalance: 0,
      });
      const sign = e.direction === "in" ? 1 : -1;
      if (e.txnType === "receipt") r.received += e.weight;
      if (e.txnType === "conversion_in") r.converted += e.weight;
      if (e.txnType === "issue") r.issued += e.weight;
      if (e.txnType === "scrap_return") r.scrap += e.weight;
      if (e.txnType === "finished") r.jewelleryMade += e.weight;
      if (e.txnType === "delivery") r.delivered += e.weight;
      if (e.item === "gold") r.goldBalance += sign * e.weight;
      else r.jewelleryBalance += sign * e.weight;
    }
    const rows = Object.entries(by)
      .map(([id, r]) => ({
        id,
        customer: cust[id]?.name || "—",
        code: cust[id]?.code || "",
        ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, r3(v)])),
      }))
      .sort((a, b) => a.customer.localeCompare(b.customer));
    res.json(
      report(
        req,
        [
          { key: "customer", label: "Customer" },
          { key: "received", label: "Gold received (g)", type: "wt" },
          { key: "converted", label: "After conversion (g)", type: "wt" },
          { key: "issued", label: "Issued to workers (g)", type: "wt" },
          { key: "scrap", label: "Scrap back (g)", type: "wt" },
          { key: "jewelleryMade", label: "Jewellery received (g)", type: "wt" },
          { key: "delivered", label: "Delivered to customer (g)", type: "wt" },
          { key: "goldBalance", label: "Gold balance (g)", type: "wt" },
          {
            key: "jewelleryBalance",
            label: "Jewellery with us (g)",
            type: "wt",
          },
        ],
        rows,
      ),
    );
  }),
);

router.get(
  "/reports/own-stock",
  can("reports-view"),
  h(async (req, res) => {
    const bal = await balanceRows({ owner: "own" });
    const rows = bal.map((b) => ({
      id: `${b.item}-${b.purity}`,
      item: b.item === "gold" ? "Gold (raw)" : "Jewellery",
      purity: b.purity,
      inWeight: b.inWeight,
      outWeight: b.outWeight,
      balance: b.balance,
    }));
    const [p, s] = await Promise.all([
      Purchase.aggregate([
        { $match: { status: "active", entryType: { $ne: "opening" } } },
        {
          $group: {
            _id: "$kind",
            weight: { $sum: "$weight" },
            amount: { $sum: "$amount" },
          },
        },
      ]),
      Sale.aggregate([
        { $match: { status: "active" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$total" },
            weight: { $sum: { $sum: "$items.weight" } },
          },
        },
      ]),
    ]);
    const g = p.find((x) => x._id === "gold");
    const t = p.find((x) => x._id === "tool");
    res.json({
      ...report(
        req,
        [
          { key: "item", label: "Stock" },
          { key: "purity", label: "Purity" },
          { key: "inWeight", label: "In (g)", type: "wt" },
          { key: "outWeight", label: "Out (g)", type: "wt" },
          { key: "balance", label: "Balance (g)", type: "wt" },
        ],
        rows,
      ),
      extra: {
        goldPurchasedWeight: r3(g?.weight),
        goldPurchasedAmount: r2(g?.amount),
        toolsAmount: r2(t?.amount),
        salesAmount: r2(s[0]?.total),
        salesWeight: r3(s[0]?.weight),
      },
    });
  }),
);

router.get(
  "/reports/worker-jobs",
  can("reports-view"),
  h(async (req, res) => {
    const jobs = await Job.find({ status: { $ne: "cancelled" } }).populate(
      "worker",
      "name",
    );
    const by = {};
    for (const j of jobs) {
      const r = (by[j.worker?._id] ||= {
        worker: j.worker?.name || "—",
        pending: 0,
        completed: 0,
        heldWeight: 0,
        wastage: 0,
        issued: 0,
      });
      r.issued += j.issuedWeight;
      if (j.status === "issued") {
        r.pending += 1;
        r.heldWeight += j.issuedWeight;
      } else {
        r.completed += 1;
        r.wastage += j.wastage;
      }
    }
    const rows = Object.entries(by)
      .map(([id, r]) => ({
        id,
        ...r,
        heldWeight: r3(r.heldWeight),
        wastage: r3(r.wastage),
        issued: r3(r.issued),
      }))
      .sort((a, b) => a.worker.localeCompare(b.worker));
    res.json(
      report(
        req,
        [
          { key: "worker", label: "Worker / vendor" },
          { key: "pending", label: "Pending jobs" },
          { key: "completed", label: "Completed jobs" },
          { key: "issued", label: "Total issued (g)", type: "wt" },
          { key: "heldWeight", label: "Gold held now (g)", type: "wt" },
          { key: "wastage", label: "Total wastage (g)", type: "wt" },
        ],
        rows,
      ),
    );
  }),
);

router.get(
  "/reports/making-gst",
  can("reports-view"),
  h(async (req, res) => {
    const f = {
      owner: "customer",
      invoiceNo: { $ne: "" },
      status: { $ne: "cancelled" },
    };
    const range = dateMatch(req.query);
    if (Object.keys(range).length) f.invoiceDate = range;
    const jobs = await Job.find(f)
      .populate("customer", "name")
      .sort({ invoiceDate: -1 });
    const pays = await Payment.find({
      job: { $in: jobs.map((j) => j._id) },
      status: "active",
    });
    const paid = {};
    pays.forEach((p) => {
      paid[p.job] = (paid[p.job] || 0) + p.amount;
    });
    const rows = jobs.map((j) => ({
      id: j.id,
      invoiceNo: j.invoiceNo,
      date: j.invoiceDate,
      customer: j.customer?.name || "—",
      jobNo: j.jobNo,
      making: j.makingCharge,
      offer: j.offerAmount || 0,
      taxable: j.taxableValue || j.makingCharge,
      taxNames: j.taxes?.length
        ? j.taxes.map((t) => `${t.name} ${t.rate}%`).join(" + ")
        : `GST ${j.gstRate}%`,
      gstRate: j.gstRate,
      gst: j.gstAmount,
      total: j.totalCharge,
      paid: r2(paid[j._id] || 0),
      outstanding: r2(j.totalCharge - (paid[j._id] || 0)),
    }));
    const sum = (k) => r2(rows.reduce((s, r) => s + (r[k] || 0), 0));
    res.json(
      report(
        req,
        [
          { key: "invoiceNo", label: "Invoice" },
          { key: "date", label: "Date", type: "date" },
          { key: "customer", label: "Customer" },
          { key: "jobNo", label: "Job" },
          { key: "making", label: "Making (₹)", type: "money" },
          { key: "offer", label: "Offer (₹)", type: "money" },
          { key: "taxable", label: "Taxable (₹)", type: "money" },
          { key: "taxNames", label: "Taxes" },
          { key: "gstRate", label: "Total tax %", type: "pct" },
          { key: "gst", label: "GST (₹)", type: "money" },
          { key: "total", label: "Total (₹)", type: "money" },
          { key: "paid", label: "Paid (₹)", type: "money" },
          { key: "outstanding", label: "Outstanding (₹)", type: "money" },
        ],
        rows,
        {
          invoiceNo: "Total",
          making: sum("making"),
          offer: sum("offer"),
          taxable: sum("taxable"),
          gst: sum("gst"),
          total: sum("total"),
          paid: sum("paid"),
          outstanding: sum("outstanding"),
        },
      ),
    );
  }),
);

/* ---------- dashboard ---------- */
router.get(
  "/dashboard",
  h(async (_req, res) => {
    const [bal, pending, completed, ownJewel, sales, jobs, recent] =
      await Promise.all([
        balanceRows({}),
        Job.countDocuments({ status: "issued" }),
        Job.countDocuments({ status: "completed" }),
        Jewellery.countDocuments({ owner: "own", status: "in_stock" }),
        Sale.find({
          status: "active",
          date: { $gte: new Date(Date.now() - 30 * 864e5) },
        }),
        Job.find({
          owner: "customer",
          invoiceNo: { $ne: "" },
          status: { $ne: "cancelled" },
        }),
        Ledger.find()
          .sort({ createdAt: -1 })
          .limit(8)
          .populate("customer", "name"),
      ]);
    const sumOf = (fn) => r3(bal.filter(fn).reduce((s, b) => s + b.balance, 0));
    const pays = await Payment.find({
      status: "active",
      job: { $in: jobs.map((j) => j._id) },
    });
    const billed = jobs.reduce((s, j) => s + j.totalCharge, 0);
    const paid = pays.reduce((s, p) => s + p.amount, 0);

    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const week = await Ledger.find({
      date: { $gte: days[0] },
      txnType: { $in: ["receipt", "purchase", "issue", "finished"] },
    });
    const chart = days.map((d) => {
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const inRange = week.filter((e) => e.date >= d && e.date < next);
      const w = (types) =>
        r3(
          inRange
            .filter((e) => types.includes(e.txnType))
            .reduce((s, e) => s + e.weight, 0),
        );
      return {
        day: d.toLocaleDateString("en-IN", { weekday: "short" }),
        received: w(["receipt", "purchase"]),
        issued: w(["issue"]),
        finished: w(["finished"]),
      };
    });
    const purities = {};
    bal
      .filter((b) => b.item === "gold" && b.balance > 0)
      .forEach((b) => {
        purities[b.purity] = r3((purities[b.purity] || 0) + b.balance);
      });

    res.json({
      data: {
        ownGold: sumOf((b) => b.owner === "own" && b.item === "gold"),
        customerGold: sumOf((b) => b.owner === "customer" && b.item === "gold"),
        ownJewelleryWeight: sumOf(
          (b) => b.owner === "own" && b.item === "jewellery",
        ),
        customerJewelleryWeight: sumOf(
          (b) => b.owner === "customer" && b.item === "jewellery",
        ),
        ownJewelleryPieces: ownJewel,
        pendingJobs: pending,
        completedJobs: completed,
        sales30: r2(sales.reduce((s, x) => s + x.total, 0)),
        salesCount30: sales.length,
        billed: r2(billed),
        paid: r2(paid),
        outstanding: r2(billed - paid),
        chart,
        purities,
        recent: recent.map((e) => ({
          id: e.id,
          txnType: e.txnType,
          item: e.item,
          direction: e.direction,
          owner: e.owner,
          weight: e.weight,
          purity: e.purity,
          refNo: e.refNo,
          customer: e.customer?.name || null,
          date: e.date,
        })),
      },
    });
  }),
);

export default router;
