import {
  Conversion,
  Customer,
  GoldReceipt,
  Jewellery,
  Job,
  Ledger,
  Payment,
  Purchase,
  Sale,
  Setting,
  TaxRate,
  Worker,
} from "./models.js";
import {
  HttpError,
  bad,
  dupGuard,
  isId,
  nextNumber,
  nonNeg,
  positive,
  purityOf,
  r2,
  r3,
  toDate,
} from "./utils.js";
import { commit, postLedger, reverseLedger } from "./stock.js";

export const getSettings = async () =>
  (await Setting.findOne({ key: "main" })) ||
  (await Setting.create({ key: "main" }));
const OWNERS = ["own", "customer"];

async function needCustomer(id) {
  if (!isId(id)) throw bad("Select a customer");
  const c = await Customer.findById(id);
  if (!c) throw bad("Customer not found");
  if (c.status === 0) throw bad("Customer is inactive");
  return c;
}
async function needWorker(id) {
  if (!isId(id)) throw bad("Select a worker / vendor");
  const w = await Worker.findById(id);
  if (!w) throw bad("Worker / vendor not found");
  if (w.status === 0) throw bad("Worker / vendor is inactive");
  return w;
}
async function pickSupplier(body, required, forKind) {
  let supplierId = null;
  let supplier = String(body.supplier || "").trim();
  if (isId(body.supplierId)) {
    const w = await needWorker(body.supplierId);
    if (forKind === "tool" && w.kind !== "tool_vendor")
      throw bad("Select a tools & equipment vendor for a tool purchase");
    if (forKind !== "tool" && w.kind === "tool_vendor")
      throw bad("That is a tools & equipment vendor - choose a gold / jewellery supplier");
    supplierId = w._id;
    supplier = w.name;
  }
  if (required && !supplier)
    throw bad("Select the supplier / vendor you bought from");
  return { supplierId, supplier };
}

/** taxes picked by the user (body.taxRates = [ids]); falls back to the default taxes of that type */
async function resolveTaxes(body, type, required) {
  let ids = null;
  if (Array.isArray(body.taxRates)) ids = body.taxRates.filter(isId).map(String);
  else if (isId(body.taxRate)) ids = [String(body.taxRate)];
  let list;
  if (ids) {
    const uniq = [...new Set(ids)];
    list = await TaxRate.find({ _id: { $in: uniq } });
    if (list.length !== uniq.length) throw bad("Tax rate not found");
  } else list = await TaxRate.find({ type, isDefault: true, status: 1 });
  if (list.some((t) => t.status === 0))
    throw bad("A selected tax is inactive");
  if (required && !list.length)
    throw bad("Select at least one tax (add taxes in Tax Rates)");
  return list.map((t) => ({ taxRate: t._id, name: t.name, rate: t.rate }));
}
/** every tax line is calculated on the same base: base x rate / 100 */
function applyTaxes(doc, base) {
  if (doc.taxes?.length) {
    doc.taxes.forEach((t) => {
      t.amount = r2((base * t.rate) / 100);
    });
    doc.gstAmount = r2(doc.taxes.reduce((s, t) => s + t.amount, 0));
    doc.gstRate = r3(doc.taxes.reduce((s, t) => s + t.rate, 0));
  } else doc.gstAmount = r2((base * (doc.gstRate || 0)) / 100); // bills made before multi-tax
}
function ownerCustomer(body) {
  if (!OWNERS.includes(body.owner)) throw bad("Owner must be own or customer");
  return body.owner === "customer" ? needCustomer(body.customer) : null;
}

/* 1 · customer gold bar / old gold receipt */
export async function createReceipt(body, userId) {
  const customer = await needCustomer(body.customer);
  if (!Array.isArray(body.items) || !body.items.length)
    throw bad("Add at least one gold item");
  const items = body.items.map((i, n) => ({
    kind: i.kind === "old" ? "old" : "bar",
    description: String(i.description || "").trim(),
    weight: r3(positive(i.weight, `Item ${n + 1} weight`)),
    purity: purityOf(i.purity, `Item ${n + 1} purity`),
  }));
  const date = toDate(body.date);
  const totalWeight = r3(items.reduce((s, i) => s + i.weight, 0));
  const fineWeight = r3(
    items.reduce((s, i) => s + (i.weight * i.purity) / 1000, 0),
  );
  await dupGuard(GoldReceipt, {
    customer: customer._id,
    totalWeight,
    fineWeight,
  });
  const rate = nonNeg(body.rate, "Rate");
  const doc = new GoldReceipt({
    receiptNo: await nextNumber("RCT"),
    customer: customer._id,
    date,
    items,
    totalWeight,
    fineWeight,
    rate,
    value: r2(fineWeight * rate),
    notes: body.notes || "",
    createdBy: userId,
  });
  const entries = items.map((i) => ({
    owner: "customer",
    customer: customer._id,
    item: "gold",
    direction: "in",
    weight: i.weight,
    purity: i.purity,
    txnType: "receipt",
    refModel: "GoldReceipt",
    refId: doc._id,
    refNo: doc.receiptNo,
    date,
    note: i.description,
    createdBy: userId,
  }));
  return commit(doc, entries);
}

/* 2 · 24K -> 22K conversion (own or customer) */
export async function createConversion(body, userId) {
  const customer = await ownerCustomer(body);
  const cfg = await getSettings();
  const sourcePurity = purityOf(body.sourcePurity, "Source purity");
  const targetPurity = purityOf(
    body.targetPurity || cfg.basePurity,
    "Target purity",
  );
  // lower purity: alloy is added; same purity: re-melt, nothing added;
  // higher purity (refining, e.g. 22K -> 24K): alloy is removed, so the weight comes down.
  // In every case the fine gold stays the same.
  const inputWeight = r3(positive(body.inputWeight, "Input weight"));
  const fineWeight = r3((inputWeight * sourcePurity) / 1000);
  const outputWeight = r3((inputWeight * sourcePurity) / targetPurity);
  const date = toDate(body.date);
  await dupGuard(Conversion, {
    owner: body.owner,
    customer: customer?._id || null,
    sourcePurity,
    inputWeight,
  });
  const doc = new Conversion({
    convNo: await nextNumber("CNV"),
    owner: body.owner,
    customer: customer?._id || null,
    date,
    sourcePurity,
    targetPurity,
    inputWeight,
    outputWeight,
    fineWeight,
    alloyAdded: r3(outputWeight - inputWeight),
    convertedTo: String(body.convertedTo || "").trim(),
    notes: body.notes || "",
    createdBy: userId,
  });
  const common = {
    owner: body.owner,
    customer: customer?._id || null,
    item: "gold",
    refModel: "Conversion",
    refId: doc._id,
    refNo: doc.convNo,
    date,
    createdBy: userId,
  };
  return commit(doc, [
    {
      ...common,
      direction: "out",
      weight: inputWeight,
      purity: sourcePurity,
      txnType: "conversion_out",
    },
    {
      ...common,
      direction: "in",
      weight: outputWeight,
      purity: targetPurity,
      txnType: "conversion_in",
    },
  ]);
}

/* 3 · own stock in: gold / ready jewellery (bought or opening stock) and tools (register only) */
export async function createPurchase(body, userId) {
  const date = toDate(body.date);
  const kind = body.kind;
  if (!["gold", "jewellery", "tool"].includes(kind))
    throw bad("Purchase kind must be gold, jewellery or tool");
  const opening = kind !== "tool" && body.entryType === "opening";
  const { supplierId, supplier } = await pickSupplier(body, !opening, kind);
  const has = (v) => v !== undefined && v !== null && v !== "";
  const common = {
    kind,
    entryType: opening ? "opening" : "purchase",
    supplier,
    supplierId,
    invoiceNo: body.invoiceNo || "",
    date,
    notes: body.notes || "",
    createdBy: userId,
  };

  if (kind === "tool") {
    const itemName = String(body.itemName || "").trim();
    if (!itemName) throw bad("Tool / equipment name is required");
    const quantity = positive(has(body.quantity) ? body.quantity : 1, "Quantity");
    if (!has(body.amount)) throw bad("Amount is required");
    const rate = has(body.rate) ? r2(positive(body.rate, "Price per unit")) : 0;
    const amount = r2(positive(body.amount, "Amount"));
    await dupGuard(Purchase, { kind: "tool", itemName, amount, supplier });
    return Purchase.create({
      ...common,
      purchaseNo: await nextNumber("PUR"),
      itemName,
      size: String(body.size || "").trim(),
      quantity,
      rate,
      amount,
    });
  }

  if (kind === "gold") {
    const weight = r3(positive(body.weight, "Weight"));
    const purity = purityOf(body.purity);
    const rate = nonNeg(body.rate, "Rate");
    if (!opening && !has(body.amount)) throw bad("Amount is required");
    const amount = has(body.amount)
      ? r2(opening ? nonNeg(body.amount, "Amount") : positive(body.amount, "Amount"))
      : 0;
    await dupGuard(Purchase, { kind: "gold", weight, purity, supplier, amount });
    const doc = new Purchase({
      ...common,
      purchaseNo: await nextNumber("PUR"),
      itemName: body.itemName || "Gold",
      weight,
      purity,
      rate,
      amount,
    });
    return commit(doc, [
      {
        owner: "own",
        customer: null,
        item: "gold",
        direction: "in",
        weight,
        purity,
        txnType: opening ? "opening" : "purchase",
        refModel: "Purchase",
        refId: doc._id,
        refNo: doc.purchaseNo,
        date,
        createdBy: userId,
      },
    ]);
  }

  // ready-made jewellery -> own jewellery stock (one tag per piece)
  if (!Array.isArray(body.pieces) || !body.pieces.length)
    throw bad("Add at least one jewellery piece");
  const cfg = await getSettings();
  const pieces = body.pieces.map((p, n) => {
    const grossWeight = r3(positive(p.grossWeight, `Piece ${n + 1} gross weight`));
    const stoneWeight = r3(nonNeg(p.stoneWeight, `Piece ${n + 1} stone / other weight`));
    if (stoneWeight >= grossWeight)
      throw bad(`Piece ${n + 1}: stone / other weight must be less than the gross weight`);
    return {
      name: String(p.name || "").trim() || `Piece ${n + 1}`,
      product: String(p.product || "General").trim(),
      grossWeight,
      stoneWeight,
      weight: r3(grossWeight - stoneWeight),
      purity: purityOf(p.purity || cfg.basePurity, `Piece ${n + 1} purity`),
    };
  });
  const weight = r3(pieces.reduce((s, p) => s + p.weight, 0));
  const rate = nonNeg(body.rate, "Rate per gram");
  if (!opening && !has(body.amount)) throw bad("Amount is required");
  const amount = has(body.amount)
    ? r2(opening ? nonNeg(body.amount, "Amount") : positive(body.amount, "Amount"))
    : 0;
  await dupGuard(Purchase, { kind: "jewellery", weight, supplier, amount });
  const tags = [];
  for (let i = 0; i < pieces.length; i += 1) tags.push(await nextNumber("TAG"));
  const location = String(body.location || "Shop").trim() || "Shop";
  const doc = new Purchase({
    ...common,
    purchaseNo: await nextNumber("PUR"),
    itemName: `${pieces.length} piece(s)`,
    quantity: pieces.length,
    weight,
    rate,
    amount,
    location,
    pieces: pieces.map((p, i) => ({ ...p, tag: tags[i] })),
  });
  await commit(
    doc,
    pieces.map((p) => ({
      owner: "own",
      customer: null,
      item: "jewellery",
      direction: "in",
      weight: p.weight,
      purity: p.purity,
      txnType: opening ? "opening" : "purchase",
      refModel: "Purchase",
      refId: doc._id,
      refNo: doc.purchaseNo,
      date,
      note: p.name,
      createdBy: userId,
    })),
  );
  try {
    await Jewellery.insertMany(
      pieces.map((p, i) => ({
        tag: tags[i],
        owner: "own",
        customer: null,
        purchase: doc._id,
        name: p.name,
        product: p.product,
        grossWeight: p.grossWeight,
        stoneWeight: p.stoneWeight,
        weight: p.weight,
        purity: p.purity,
        location,
        status: "in_stock",
      })),
    );
  } catch (err) {
    await Ledger.deleteMany({ refId: doc._id });
    await Purchase.deleteOne({ _id: doc._id });
    throw err;
  }
  return doc;
}

/* 4 · issue gold to a worker (job work) */
export async function createJob(body, userId) {
  const customer = await ownerCustomer(body);
  const worker = await needWorker(body.worker);
  if (worker.kind === "tool_vendor")
    throw bad("Tools & equipment vendors cannot be used for job work");
  const issuedWeight = r3(positive(body.issuedWeight, "Issue weight"));
  const cfg = await getSettings();
  const issuedPurity = purityOf(
    body.issuedPurity || cfg.basePurity,
    "Issue purity",
  );
  const date = toDate(body.date);
  await dupGuard(Job, {
    owner: body.owner,
    customer: customer?._id || null,
    worker: worker._id,
    issuedWeight,
    issuedPurity,
  });
  const doc = new Job({
    jobNo: await nextNumber("JOB"),
    workerReceiptNo: body.owner === "customer" ? await nextNumber("WR") : "",
    owner: body.owner,
    customer: customer?._id || null,
    worker: worker._id,
    product: body.product || "",
    date,
    issuedWeight,
    issuedPurity,
    notes: body.notes || "",
    createdBy: userId,
  });
  return commit(doc, [
    {
      owner: body.owner,
      customer: customer?._id || null,
      item: "gold",
      direction: "out",
      weight: issuedWeight,
      purity: issuedPurity,
      txnType: "issue",
      refModel: "Job",
      refId: doc._id,
      refNo: doc.jobNo,
      worker: worker._id,
      date,
      createdBy: userId,
    },
  ]);
}

/* 5 · receive finished jewellery (+ scrap) from the worker */
export async function receiveJob(id, body, userId) {
  const job = await Job.findById(id);
  if (!job) throw new HttpError(404, "Job not found");
  if (job.status !== "issued") throw bad(`Job is already ${job.status}`);
  if (!Array.isArray(body.pieces) || !body.pieces.length)
    throw bad("Add at least one finished piece");
  // gross = full piece weight, stone = non-gold weight, net (weight) = gold weight used for stock & wastage
  const pieces = body.pieces.map((p, n) => {
    const grossWeight = r3(
      positive(p.grossWeight ?? p.weight, `Piece ${n + 1} gross weight`),
    );
    const stoneWeight = r3(
      nonNeg(p.stoneWeight, `Piece ${n + 1} stone / other weight`),
    );
    if (stoneWeight >= grossWeight)
      throw bad(
        `Piece ${n + 1}: stone / other weight must be less than the gross weight`,
      );
    return {
      name: String(p.name || "").trim() || `Piece ${n + 1}`,
      product: String(p.product || "General").trim(),
      grossWeight,
      stoneWeight,
      weight: r3(grossWeight - stoneWeight),
      purity: p.purity
        ? purityOf(p.purity, `Piece ${n + 1} purity`)
        : job.issuedPurity,
    };
  });
  const finishedWeight = r3(pieces.reduce((s, p) => s + p.weight, 0));
  const scrapWeight = r3(nonNeg(body.scrapWeight, "Scrap weight"));
  const wastage = r3(job.issuedWeight - finishedWeight - scrapWeight);
  if (wastage < -0.0005)
    throw bad(
      `Received weight (${r3(finishedWeight + scrapWeight)} g) is more than issued (${job.issuedWeight} g)`,
    );
  const date = toDate(body.date);
  const common = {
    owner: job.owner,
    customer: job.customer,
    refModel: "Job",
    refId: job._id,
    refNo: job.jobNo,
    worker: job.worker,
    date,
    createdBy: userId,
  };

  const tags = [];
  for (let i = 0; i < pieces.length; i += 1) tags.push(await nextNumber("TAG"));
  const entries = pieces.map((p) => ({
    ...common,
    item: "jewellery",
    direction: "in",
    weight: p.weight,
    purity: p.purity,
    txnType: "finished",
    note: p.name,
  }));
  if (scrapWeight > 0)
    entries.push({
      ...common,
      item: "gold",
      direction: "in",
      weight: scrapWeight,
      purity: job.issuedPurity,
      txnType: "scrap_return",
      note: "Scrap / filings returned",
    });

  // ledger first (it validates), then the job + piece records
  await postLedger(entries);
  try {
    job.pieces = pieces;
    job.finishedWeight = finishedWeight;
    job.scrapWeight = scrapWeight;
    job.wastage = Math.max(0, wastage);
    job.status = "completed";
    job.receivedAt = date;
    if (job.owner === "customer" && job.invoiceNo) recalcCharges(job); // keep the bill in step when billed per gram
    await job.save();
    await Jewellery.insertMany(
      pieces.map((p, i) => ({
        tag: tags[i],
        owner: job.owner,
        customer: job.customer,
        job: job._id,
        name: p.name,
        product: p.product,
        grossWeight: p.grossWeight,
        stoneWeight: p.stoneWeight,
        weight: p.weight,
        purity: p.purity,
        location: body.location || "Shop",
        status: "in_stock",
      })),
    );
  } catch (err) {
    await Ledger.deleteMany({
      refId: job._id,
      txnType: { $in: ["finished", "scrap_return"] },
    });
    throw err;
  }
  return job;
}

export async function cancelJob(id, userId) {
  const job = await Job.findById(id);
  if (!job) throw new HttpError(404, "Job not found");
  if (job.status !== "issued")
    throw bad("Only jobs that are still issued can be cancelled");
  if (await Payment.exists({ job: job._id, status: "active" }))
    throw bad("This job has payments recorded - void the payments first");
  await reverseLedger(job._id, userId, `job ${job.jobNo} cancelled`);
  job.status = "cancelled";
  return job.save();
}

/* 6 · making charge + GST (customer jobs only) */
function makingOf(job) {
  const basis = job.finishedWeight || job.issuedWeight;
  return r2(
    job.makingChargeType === "per_gram"
      ? job.makingChargeValue * basis
      : job.makingChargeValue,
  );
}
/** making charge -> less offer -> taxable value -> taxes -> total */
function recalcCharges(job) {
  job.makingCharge = makingOf(job);
  const v = job.offerValue || 0;
  const offer = job.offerType === "percent" ? (job.makingCharge * v) / 100 : v;
  job.offerAmount = r2(Math.min(offer, job.makingCharge));
  job.taxableValue = r2(job.makingCharge - job.offerAmount);
  applyTaxes(job, job.taxableValue);
  job.totalCharge = r2(job.taxableValue + job.gstAmount);
}
export async function setCharges(id, body) {
  const job = await Job.findById(id);
  if (!job) throw new HttpError(404, "Job not found");
  if (job.owner !== "customer")
    throw bad("Making charges apply to customer jobs only");
  if (job.status === "cancelled") throw bad("Job is cancelled");
  const taxes = await resolveTaxes(body, "making", true);
  job.makingChargeType =
    body.makingChargeType === "fixed" ? "fixed" : "per_gram";
  job.makingChargeValue = nonNeg(body.makingChargeValue, "Making charge");
  job.offerType = body.offerType === "percent" ? "percent" : "amount";
  job.offerValue = r2(nonNeg(body.offerValue, "Offer"));
  if (job.offerType === "percent" && job.offerValue > 100)
    throw bad("Offer percentage cannot be more than 100");
  if (job.offerType === "amount" && job.offerValue > makingOf(job) + 0.004)
    throw bad("Offer amount cannot be more than the making charge");
  job.taxes = taxes;
  job.taxRate = taxes[0].taxRate;
  job.gstRate = r3(taxes.reduce((s, t) => s + t.rate, 0));
  recalcCharges(job);
  const paid = (await Payment.find({ job: job._id, status: "active" })).reduce(
    (s, p) => s + p.amount,
    0,
  );
  if (job.totalCharge + 0.005 < paid)
    throw bad(
      `Total ${job.totalCharge} is less than the amount already paid (${r2(paid)})`,
    );
  if (!job.invoiceNo) {
    job.invoiceNo = await nextNumber("INV");
    job.invoiceDate = new Date();
  }
  return job.save();
}

export async function deliverJob(id, userId) {
  const job = await Job.findById(id);
  if (!job) throw new HttpError(404, "Job not found");
  if (job.owner !== "customer")
    throw bad("Only customer jewellery is delivered; own jewellery is sold");
  if (job.status !== "completed")
    throw bad("Receive the finished jewellery first");
  if (job.delivered) throw bad("Already delivered to the customer");
  const items = await Jewellery.find({ job: job._id, status: "in_stock" });
  await postLedger(
    items.map((j) => ({
      owner: "customer",
      customer: job.customer,
      item: "jewellery",
      direction: "out",
      weight: j.weight,
      purity: j.purity,
      txnType: "delivery",
      refModel: "Job",
      refId: job._id,
      refNo: job.jobNo,
      date: new Date(),
      note: `Delivered ${j.tag}`,
      createdBy: userId,
    })),
  );
  await Jewellery.updateMany(
    { job: job._id, status: "in_stock" },
    { status: "delivered" },
  );
  job.delivered = true;
  job.deliveredAt = new Date();
  return job.save();
}

/* 7 · customer payment for making charges */
export async function paidFor(jobId) {
  const rows = await Payment.find({ job: jobId, status: "active" });
  return r2(rows.reduce((s, p) => s + p.amount, 0));
}
export async function createPayment(body, userId) {
  if (!isId(body.job)) throw bad("Select a job");
  const job = await Job.findById(body.job);
  if (!job || job.owner !== "customer")
    throw bad("Payments are recorded against customer jobs");
  if (!job.invoiceNo) throw bad("Set the making charge for this job first");
  const amount = r2(positive(body.amount, "Amount"));
  const due = r2(job.totalCharge - (await paidFor(job._id)));
  if (amount > due + 0.005)
    throw bad(`Amount is more than the balance due (${due})`);
  await dupGuard(Payment, { job: job._id, amount });
  return Payment.create({
    receiptNo: await nextNumber("PAY"),
    job: job._id,
    customer: job.customer,
    amount,
    mode: body.mode || "cash",
    date: toDate(body.date),
    notes: body.notes || "",
    createdBy: userId,
  });
}
export async function voidPayment(id) {
  const p = await Payment.findById(id);
  if (!p) throw new HttpError(404, "Payment not found");
  if (p.status === "void") throw bad("Already void");
  p.status = "void";
  return p.save();
}

/* 8 · sell own jewellery */
export async function createSale(body, userId) {
  if (!Array.isArray(body.items) || !body.items.length)
    throw bad("Select at least one jewellery item");
  const ids = body.items.map((i) => i.jewellery);
  if (new Set(ids.map(String)).size !== ids.length)
    throw bad("The same item was added twice");
  if (!ids.every(isId)) throw bad("Invalid item selected");
  const stock = await Jewellery.find({
    _id: { $in: ids },
    owner: "own",
    status: "in_stock",
  });
  if (stock.length !== ids.length)
    throw bad("One or more items are not available in own stock");
  const byId = Object.fromEntries(stock.map((j) => [String(j._id), j]));
  const items = body.items.map((i) => {
    const j = byId[String(i.jewellery)];
    return {
      jewellery: j._id,
      tag: j.tag,
      name: j.name,
      weight: j.weight,
      purity: j.purity,
      amount: r2(positive(i.amount, `Amount for ${j.tag}`)),
    };
  });
  const taxes = await resolveTaxes(body, "sale", false);
  const subtotal = r2(items.reduce((s, i) => s + i.amount, 0));
  taxes.forEach((t) => {
    t.amount = r2((subtotal * t.rate) / 100);
  });
  const gstRate = r3(taxes.reduce((s, t) => s + t.rate, 0));
  const gstAmount = r2(taxes.reduce((s, t) => s + t.amount, 0));
  const date = toDate(body.date);
  await dupGuard(Sale, { subtotal, buyerName: body.buyerName || "Walk-in" });
  const doc = new Sale({
    invoiceNo: await nextNumber("SAL"),
    date,
    buyerName: body.buyerName || "Walk-in",
    buyerMobile: body.buyerMobile || "",
    items,
    subtotal,
    taxes,
    gstRate,
    gstAmount,
    total: r2(subtotal + gstAmount),
    mode: body.mode || "cash",
    notes: body.notes || "",
    createdBy: userId,
  });
  await commit(
    doc,
    items.map((i) => ({
      owner: "own",
      customer: null,
      item: "jewellery",
      direction: "out",
      weight: i.weight,
      purity: i.purity,
      txnType: "sale",
      refModel: "Sale",
      refId: doc._id,
      refNo: doc.invoiceNo,
      date,
      note: i.tag,
      createdBy: userId,
    })),
  );
  await Jewellery.updateMany(
    { _id: { $in: ids } },
    { status: "sold", sale: doc._id },
  );
  return doc;
}

/* void (reverses stock; blocked automatically if the stock was already used) */
export async function voidDoc(kind, id, userId) {
  const map = {
    receipt: GoldReceipt,
    conversion: Conversion,
    purchase: Purchase,
    sale: Sale,
  };
  const Model = map[kind];
  if (!Model) throw new HttpError(404, "Unknown document type");
  const doc = await Model.findById(id);
  if (!doc) throw new HttpError(404, "Document not found");
  if (doc.status === "void") throw bad("Already void");
  if (kind === "purchase" && doc.kind === "tool") {
    doc.status = "void";
    return doc.save();
  }
  if (kind === "purchase" && doc.kind === "jewellery") {
    const used = await Jewellery.countDocuments({
      purchase: doc._id,
      status: { $ne: "in_stock" },
    });
    if (used)
      throw bad("Some pieces of this purchase are already sold, so it cannot be voided");
  }
  await reverseLedger(
    doc._id,
    userId,
    `${kind} ${doc.receiptNo || doc.convNo || doc.purchaseNo || doc.invoiceNo} voided`,
  );
  if (kind === "purchase" && doc.kind === "jewellery")
    await Jewellery.updateMany({ purchase: doc._id }, { status: "void" });
  if (kind === "sale")
    await Jewellery.updateMany(
      { sale: doc._id },
      { status: "in_stock", sale: null },
    );
  doc.status = "void";
  return doc.save();
}
