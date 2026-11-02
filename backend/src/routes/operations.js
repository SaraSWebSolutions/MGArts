import { Router } from "express";
import {
  Conversion,
  GoldReceipt,
  Jewellery,
  Job,
  Payment,
  Purchase,
  Sale,
} from "../models.js";
import { auth, can } from "../auth.js";
import { HttpError, h, isId } from "../utils.js";
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

/* ---------- customer gold receipts ---------- */
router.get(
  "/gold-receipts",
  h(async (req, res) => {
    const f = { ...range(req.query) };
    if (isId(req.query.customer)) f.customer = req.query.customer;
    res.json({
      data: await GoldReceipt.find(f)
        .populate("customer")
        .sort({ date: -1, createdAt: -1 })
        .limit(500),
    });
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
    res.json({
      data: await Conversion.find(f)
        .populate("customer")
        .sort({ date: -1, createdAt: -1 })
        .limit(500),
    });
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
    if (["gold", "jewellery", "tool"].includes(req.query.kind)) f.kind = req.query.kind;
    res.json({
      data: await Purchase.find(f).sort({ date: -1, createdAt: -1 }).limit(500),
    });
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
    if (isId(req.query.customer)) f.customer = req.query.customer;
    if (isId(req.query.worker)) f.worker = req.query.worker;
    const jobs = await Job.find(f)
      .populate(jobPop)
      .sort({ date: -1, createdAt: -1 })
      .limit(500);
    res.json({ data: await withPaid(jobs) });
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
    if (isId(req.query.job)) f.job = req.query.job;
    if (isId(req.query.customer)) f.customer = req.query.customer;
    res.json({
      data: await Payment.find(f)
        .populate("customer")
        .populate("job", "jobNo invoiceNo")
        .sort({ date: -1, createdAt: -1 })
        .limit(500),
    });
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
    if (isId(req.query.customer)) f.customer = req.query.customer;
    if (req.query.purity) f.purity = Number(req.query.purity);
    if (req.query.product) f.product = req.query.product;
    if (req.query.location) f.location = req.query.location;
    res.json({
      data: await Jewellery.find(f)
        .populate("customer")
        .sort({ createdAt: -1 })
        .limit(1000),
    });
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
  h(async (req, res) =>
    res.json({
      data: await Sale.find({ ...range(req.query) })
        .sort({ date: -1, createdAt: -1 })
        .limit(500),
    }),
  ),
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
