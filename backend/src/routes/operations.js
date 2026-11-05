import { Router } from "express";
import {
  Conversion,
  Customer,
  GoldReceipt,
  Jewellery,
  Job,
  Payment,
  Purchase,
  Sale,
  Worker,
} from "../models.js";
import { auth, can } from "../auth.js";
import {
  HttpError,
  h,
  isId,
  listPage,
  oid,
  pageOf,
  r2,
  r3,
  rx,
  searchOf,
  totals,
} from "../utils.js";
import * as ops from "../ops.js";

const router = Router();
router.use(auth);

const range = (q, field = "date") => {
  const m = {};
  if (q.from) m.$gte = new Date(q.from);
  if (q.to) {
    const t = new Date(q.to);
    t.setHours(23, 59, 59, 999);
    m.$lte = t;
  }
  return Object.keys(m).length ? { [field]: m } : {};
};
const found = (d) => {
  if (!d) throw new HttpError(404, "Not found");
  return d;
};
const one = async (Model, id, pop = "") =>
  found(isId(id) && (await Model.findById(id).populate(pop)));

/** ids of customers / workers whose name matches the search box */
const custIds = (term) => Customer.find({ name: rx(term) }).distinct("_id");
const workerIds = (term) => Worker.find({ name: rx(term) }).distinct("_id");
const isPaged = (req) => pageOf(req.query).paged;

/* ---------- customer gold receipts ---------- */
router.get(
  "/gold-receipts",
  h(async (req, res) => {
    const f = { ...range(req.query) };
    if (isId(req.query.customer)) f.customer = oid(req.query.customer);
    const term = searchOf(req.query);
    if (term)
      f.$or = [{ receiptNo: rx(term) }, { customer: { $in: await custIds(term) } }];
    const out = await listPage(GoldReceipt, f, req, {
      sort: { date: -1, createdAt: -1 },
      decorate: (q) => q.populate("customer"),
      legacyLimit: 500,
    });
    if (isPaged(req)) {
      const t = await totals(GoldReceipt, { ...f, status: "active" }, {
        count: { $sum: 1 },
        totalWeight: { $sum: "$totalWeight" },
        fineWeight: { $sum: "$fineWeight" },
      });
      out.summary = {
        count: t.count || 0,
        totalWeight: r3(t.totalWeight),
        fineWeight: r3(t.fineWeight),
      };
    }
    res.json(out);
  }),
);
router.get(
  "/gold-receipts/:id",
  h(async (req, res) =>
    res.json({ data: await one(GoldReceipt, req.params.id, "customer") }),
  ),
);
router.post(
  "/gold-receipts",
  can("receipts-manage"),
  h(async (req, res) => {
    const d = await ops.createReceipt(req.body, req.user._id);
    res.status(201).json({ data: await d.populate("customer") });
  }),
);
router.post(
  "/gold-receipts/:id/void",
  can("receipts-manage"),
  h(async (req, res) =>
    res.json({
      data: await ops.voidDoc("receipt", req.params.id, req.user._id),
    }),
  ),
);

/* ---------- conversions ---------- */
router.get(
  "/conversions",
  h(async (req, res) => {
    const f = { ...range(req.query) };
    if (["own", "customer"].includes(req.query.owner))
      f.owner = req.query.owner;
    const term = searchOf(req.query);
    if (term)
      f.$or = [
        { convNo: rx(term) },
        { convertedTo: rx(term) },
        { customer: { $in: await custIds(term) } },
      ];
    const out = await listPage(Conversion, f, req, {
      sort: { date: -1, createdAt: -1 },
      decorate: (q) => q.populate("customer"),
      legacyLimit: 500,
    });
    if (isPaged(req)) {
      const t = await totals(Conversion, { ...f, status: "active" }, {
        count: { $sum: 1 },
        inputWeight: { $sum: "$inputWeight" },
        alloyAdded: { $sum: "$alloyAdded" },
      });
      out.summary = {
        count: t.count || 0,
        inputWeight: r3(t.inputWeight),
        alloyAdded: r3(t.alloyAdded),
      };
    }
    res.json(out);
  }),
);
router.post(
  "/conversions",
  can("conversions-manage"),
  h(async (req, res) => {
    const d = await ops.createConversion(req.body, req.user._id);
    res.status(201).json({ data: await d.populate("customer") });
  }),
);
router.post(
  "/conversions/:id/void",
  can("conversions-manage"),
  h(async (req, res) =>
    res.json({
      data: await ops.voidDoc("conversion", req.params.id, req.user._id),
    }),
  ),
);

/* ---------- own purchases (gold + tools) ---------- */
router.get(
  "/purchases",
  h(async (req, res) => {
    const f = { ...range(req.query) };
    if (["gold", "jewellery", "tool"].includes(req.query.kind))
      f.kind = req.query.kind;
    const term = searchOf(req.query);
    if (term)
      f.$or = ["purchaseNo", "supplier", "itemName", "size", "invoiceNo"].map(
        (k) => ({ [k]: rx(term) }),
      );
    const out = await listPage(Purchase, f, req, {
      sort: { date: -1, createdAt: -1 },
      legacyLimit: 500,
    });
    if (isPaged(req)) {
      const t = await totals(Purchase, { ...f, status: "active" }, {
        count: { $sum: 1 },
        quantity: { $sum: "$quantity" },
        weight: { $sum: "$weight" },
        amount: { $sum: "$amount" },
      });
      out.summary = {
        count: t.count || 0,
        quantity: t.quantity || 0,
        weight: r3(t.weight),
        amount: r2(t.amount),
      };
    }
    res.json(out);
  }),
);
router.post(
  "/purchases",
  can("purchases-manage"),
  h(async (req, res) =>
    res
      .status(201)
      .json({ data: await ops.createPurchase(req.body, req.user._id) }),
  ),
);
router.post(
  "/purchases/:id/void",
  can("purchases-manage"),
  h(async (req, res) =>
    res.json({
      data: await ops.voidDoc("purchase", req.params.id, req.user._id),
    }),
  ),
);

/* ---------- job work ---------- */
const jobPop = ["customer", "worker", "taxRate"];
async function withPaid(jobs) {
  const list = Array.isArray(jobs) ? jobs : [jobs];
  const pays = await Payment.find({
    job: { $in: list.map((j) => j._id) },
    status: "active",
  });
  const paid = {};
  pays.forEach((p) => {
    paid[p.job] = (paid[p.job] || 0) + p.amount;
  });
  const out = list.map((j) => {
    const o = j.toJSON();
    o.paid = Math.round((paid[j._id] || 0) * 100) / 100;
    o.balance = Math.round(((j.totalCharge || 0) - o.paid) * 100) / 100;
    o.paymentStatus = !j.invoiceNo
      ? "not_billed"
      : o.balance <= 0.004
        ? "paid"
        : o.paid > 0
          ? "partial"
          : "unpaid";
    return o;
  });
  return Array.isArray(jobs) ? out : out[0];
}
router.get(
  "/jobs",
  h(async (req, res) => {
    const f = { ...range(req.query) };
    if (["own", "customer"].includes(req.query.owner))
      f.owner = req.query.owner;
    if (["issued", "completed", "cancelled"].includes(req.query.status))
      f.status = req.query.status;
    else if (req.query.exclude === "cancelled") f.status = { $ne: "cancelled" };
    if (isId(req.query.customer)) f.customer = oid(req.query.customer);
    if (isId(req.query.worker)) f.worker = oid(req.query.worker);
    const term = searchOf(req.query);
    if (term)
      f.$or = [
        { jobNo: rx(term) },
        { invoiceNo: rx(term) },
        { product: rx(term) },
        { customer: { $in: await custIds(term) } },
        { worker: { $in: await workerIds(term) } },
      ];
    const out = await listPage(Job, f, req, {
      sort: { date: -1, createdAt: -1 },
      decorate: (q) => q.populate(jobPop),
      map: withPaid,
      legacyLimit: 500,
    });
    if (isPaged(req)) {
      const t = await totals(Job, f, {
        total: { $sum: 1 },
        issued: { $sum: { $cond: [{ $eq: ["$status", "issued"] }, 1, 0] } },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        heldWeight: {
          $sum: {
            $cond: [{ $eq: ["$status", "issued"] }, "$issuedWeight", 0],
          },
        },
        invoices: {
          $sum: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ["$invoiceNo", ""] } }, 0] },
              1,
              0,
            ],
          },
        },
        billed: { $sum: "$totalCharge" },
      });
      out.summary = {
        total: t.total || 0,
        issued: t.issued || 0,
        completed: t.completed || 0,
        heldWeight: r3(t.heldWeight),
        invoices: t.invoices || 0,
        billed: r2(t.billed),
      };
      if (req.query.billing === "1") {
        const ids = await Job.distinct("_id", f);
        const p = await totals(
          Payment,
          { job: { $in: ids }, status: "active" },
          { paid: { $sum: "$amount" } },
        );
        out.summary.paid = r2(p.paid);
        out.summary.outstanding = r2(out.summary.billed - out.summary.paid);
      }
    }
    res.json(out);
  }),
);
router.get(
  "/jobs/:id",
  h(async (req, res) => {
    const job = await one(Job, req.params.id, jobPop);
    const payments = await Payment.find({
      job: job._id,
      status: "active",
    }).sort({ date: 1 });
    res.json({ data: { ...(await withPaid(job)), payments } });
  }),
);
router.post(
  "/jobs",
  can("jobs-manage"),
  h(async (req, res) => {
    const d = await ops.createJob(req.body, req.user._id);
    res.status(201).json({ data: await withPaid(await d.populate(jobPop)) });
  }),
);
router.post(
  "/jobs/:id/receive",
  can("jobs-manage"),
  h(async (req, res) => {
    const d = await ops.receiveJob(req.params.id, req.body, req.user._id);
    res.json({ data: await withPaid(await d.populate(jobPop)) });
  }),
);
router.post(
  "/jobs/:id/cancel",
  can("jobs-manage"),
  h(async (req, res) => {
    const d = await ops.cancelJob(req.params.id, req.user._id);
    res.json({ data: await withPaid(await d.populate(jobPop)) });
  }),
);
router.post(
  "/jobs/:id/deliver",
  can("jobs-manage"),
  h(async (req, res) => {
    const d = await ops.deliverJob(req.params.id, req.user._id);
    res.json({ data: await withPaid(await d.populate(jobPop)) });
  }),
);
router.put(
  "/jobs/:id/charges",
  can("billing-manage"),
  h(async (req, res) => {
    const d = await ops.setCharges(req.params.id, req.body);
    res.json({ data: await withPaid(await d.populate(jobPop)) });
  }),
);

/* ---------- payments ---------- */
router.get(
  "/payments",
  h(async (req, res) => {
    const f = { ...range(req.query) };
    if (isId(req.query.job)) f.job = oid(req.query.job);
    if (isId(req.query.customer)) f.customer = oid(req.query.customer);
    const term = searchOf(req.query);
    if (term)
      f.$or = [{ receiptNo: rx(term) }, { customer: { $in: await custIds(term) } }];
    res.json(
      await listPage(Payment, f, req, {
        sort: { date: -1, createdAt: -1 },
        decorate: (q) =>
          q.populate("customer").populate("job", "jobNo invoiceNo"),
        legacyLimit: 500,
      }),
    );
  }),
);
router.get(
  "/payments/:id",
  h(async (req, res) =>
    res.json({ data: await one(Payment, req.params.id, ["customer", "job"]) }),
  ),
);
router.post(
  "/payments",
  can("billing-manage"),
  h(async (req, res) => {
    const d = await ops.createPayment(req.body, req.user._id);
    res.status(201).json({ data: await d.populate(["customer", "job"]) });
  }),
);
router.post(
  "/payments/:id/void",
  can("billing-manage"),
  h(async (req, res) =>
    res.json({ data: await ops.voidPayment(req.params.id) }),
  ),
);

/* ---------- jewellery stock + sales ---------- */
router.get(
  "/jewellery",
  h(async (req, res) => {
    const f = {};
    if (["own", "customer"].includes(req.query.owner))
      f.owner = req.query.owner;
    if (["in_stock", "sold", "delivered"].includes(req.query.status))
      f.status = req.query.status;
    if (isId(req.query.customer)) f.customer = oid(req.query.customer);
    if (req.query.purity) f.purity = Number(req.query.purity);
    if (req.query.product) f.product = req.query.product;
    if (req.query.location) f.location = req.query.location;
    const term = searchOf(req.query);
    if (term)
      f.$or = [
        { tag: rx(term) },
        { name: rx(term) },
        { product: rx(term) },
        { customer: { $in: await custIds(term) } },
      ];
    const out = await listPage(Jewellery, f, req, {
      decorate: (q) => q.populate("customer"),
      legacyLimit: 1000,
    });
    if (isPaged(req)) {
      const [t, groups, products, locations] = await Promise.all([
        totals(Jewellery, f, { pieces: { $sum: 1 }, weight: { $sum: "$weight" } }),
        Jewellery.aggregate([
          { $match: f },
          {
            $group: {
              _id: {
                owner: "$owner",
                customer: "$customer",
                purity: "$purity",
                product: "$product",
              },
              pieces: { $sum: 1 },
              weight: { $sum: "$weight" },
            },
          },
        ]),
        Jewellery.distinct("product"),
        Jewellery.distinct("location"),
      ]);
      const cust = Object.fromEntries(
        (
          await Customer.find({
            _id: { $in: groups.map((g) => g._id.customer).filter(Boolean) },
          })
        ).map((c) => [String(c._id), c.name]),
      );
      out.summary = {
        pieces: t.pieces || 0,
        weight: r3(t.weight),
        productTypes: new Set(groups.map((g) => g._id.product)).size,
        groups: groups
          .map((g) => ({
            owner: g._id.owner,
            customer: g._id.customer ? cust[String(g._id.customer)] || "" : "",
            purity: g._id.purity,
            product: g._id.product,
            pieces: g.pieces,
            weight: r3(g.weight),
          }))
          .sort(
            (a, b) =>
              a.owner.localeCompare(b.owner) ||
              b.purity - a.purity ||
              String(a.product).localeCompare(String(b.product)),
          ),
        products: products.filter(Boolean).sort(),
        locations: locations.filter(Boolean).sort(),
      };
    }
    res.json(out);
  }),
);
router.put(
  "/jewellery/:id",
  can("jobs-manage"),
  h(async (req, res) => {
    const j = await one(Jewellery, req.params.id);
    if (j.status !== "in_stock")
      throw new HttpError(422, "Only items in stock can be edited");
    if (req.body.product !== undefined) j.product = String(req.body.product);
    if (req.body.location !== undefined) j.location = String(req.body.location);
    if (req.body.name !== undefined) j.name = String(req.body.name);
    res.json({ data: await j.save() });
  }),
);

router.get(
  "/sales",
  h(async (req, res) => {
    const f = { ...range(req.query) };
    const term = searchOf(req.query);
    if (term) f.$or = [{ invoiceNo: rx(term) }, { buyerName: rx(term) }];
    const out = await listPage(Sale, f, req, {
      sort: { date: -1, createdAt: -1 },
      legacyLimit: 500,
    });
    if (isPaged(req)) {
      const t = await totals(Sale, { ...f, status: "active" }, {
        count: { $sum: 1 },
        total: { $sum: "$total" },
        weight: { $sum: { $sum: "$items.weight" } },
      });
      out.summary = {
        count: t.count || 0,
        total: r2(t.total),
        weight: r3(t.weight),
      };
    }
    res.json(out);
  }),
);
router.get(
  "/sales/:id",
  h(async (req, res) => res.json({ data: await one(Sale, req.params.id) })),
);
router.post(
  "/sales",
  can("sales-manage"),
  h(async (req, res) =>
    res
      .status(201)
      .json({ data: await ops.createSale(req.body, req.user._id) }),
  ),
);
router.post(
  "/sales/:id/void",
  can("sales-manage"),
  h(async (req, res) =>
    res.json({ data: await ops.voidDoc("sale", req.params.id, req.user._id) }),
  ),
);

export default router;
