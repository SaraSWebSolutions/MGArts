import mongoose from "mongoose";

// every JSON response gets `id` (virtual) and no _id / __v  -> matches what the React UI expects
mongoose.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_d, ret) => {
    delete ret._id;
    return ret;
  },
});

const { Schema } = mongoose;
const ref = (name, extra = {}) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  ...extra,
});
const make = (name, def, opts = {}) =>
  mongoose.model(name, new Schema(def, { timestamps: true, ...opts }));

export const Counter = make("Counter", {
  key: { type: String, unique: true },
  seq: { type: Number, default: 0 },
});

/* ---------- administration ---------- */
export const Permission = make("Permission", {
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: "" },
});
export const Role = make("Role", {
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: "" },
  permissions: [ref("Permission")],
});
export const User = make("User", {
  name: { type: String, required: true, trim: true },
  userId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  }, // sign-in id
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  }, // optional
  mobile_number: { type: String, default: "" },
  password: { type: String, required: true },
  role_id: ref("Role", { required: true }),
  profile_image: { type: String, default: "" },
});

/* ---------- masters ---------- */
export const Customer = make("Customer", {
  code: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, default: "" },
  address: { type: String, default: "" },
  gstin: { type: String, default: "" },
  status: { type: Number, default: 1 },
});
export const Worker = make("Worker", {
  code: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  kind: {
    type: String,
    enum: ["worker", "vendor", "tool_vendor"], // tool_vendor: sells tools & equipment only (never used for job work)
    default: "worker",
  },
  mobile: { type: String, default: "" },
  address: { type: String, default: "" },
  status: { type: Number, default: 1 },
});
export const TaxRate = make("TaxRate", {
  name: { type: String, required: true, trim: true },
  rate: { type: Number, required: true, min: 0, max: 100 },
  type: { type: String, enum: ["making", "sale", "other"], default: "making" },
  isDefault: { type: Boolean, default: false },
  status: { type: Number, default: 1 },
});
export const Setting = make("Setting", {
  key: { type: String, unique: true, default: "main" },
  shopName: { type: String, default: "MG ARTS" },
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  gstin: { type: String, default: "" },
  state: { type: String, default: "Tamil Nadu" },
  basePurity: { type: Number, default: 916 }, // 22K
  barPurity: { type: Number, default: 999 }, // 24K
  sacCode: { type: String, default: "9988" },
  wastageAlertPercent: { type: Number, default: 2 },
  logo: { type: String, default: "" }, // invoice / receipt header image (uploads folder)
});

/* ---------- stock ledger : single source of truth for every gram ---------- */
export const Ledger = make("Ledger", {
  owner: { type: String, enum: ["own", "customer"], required: true },
  customer: ref("Customer", { default: null }),
  item: { type: String, enum: ["gold", "jewellery"], required: true },
  direction: { type: String, enum: ["in", "out"], required: true },
  weight: { type: Number, required: true, min: 0.001 },
  purity: { type: Number, required: true },
  txnType: { type: String, required: true }, // receipt|purchase|conversion_out|conversion_in|issue|scrap_return|finished|delivery|sale|reversal
  refModel: String,
  refId: Schema.Types.ObjectId,
  refNo: String,
  worker: ref("Worker", { default: null }),
  date: { type: Date, default: Date.now },
  note: { type: String, default: "" },
  createdBy: ref("User"),
});
Ledger.schema.index({ owner: 1, customer: 1, item: 1, purity: 1 });
Ledger.schema.index({ refId: 1 });

/* ---------- documents ---------- */
const status = { type: String, enum: ["active", "void"], default: "active" };

export const GoldReceipt = make("GoldReceipt", {
  receiptNo: { type: String, unique: true },
  customer: ref("Customer", { required: true }),
  date: { type: Date, default: Date.now },
  items: [
    {
      kind: { type: String, enum: ["bar", "old"], default: "bar" },
      description: String,
      weight: Number,
      purity: Number,
    },
  ],
  totalWeight: Number,
  fineWeight: Number,
  rate: { type: Number, default: 0 },
  value: { type: Number, default: 0 },
  notes: { type: String, default: "" },
  status,
  createdBy: ref("User"),
});

export const Conversion = make("Conversion", {
  convNo: { type: String, unique: true },
  owner: { type: String, enum: ["own", "customer"], required: true },
  customer: ref("Customer", { default: null }),
  date: { type: Date, default: Date.now },
  sourcePurity: Number,
  targetPurity: Number,
  inputWeight: Number,
  outputWeight: Number,
  fineWeight: Number,
  alloyAdded: Number,
  convertedTo: { type: String, default: "" }, // what the gold becomes: bar, chain, ring...
  notes: { type: String, default: "" },
  status,
  createdBy: ref("User"),
});

/** one tax line on a bill: copied from the Tax Rates master when the bill is made */
const taxLines = [
  {
    taxRate: ref("TaxRate"),
    name: String,
    rate: Number,
    amount: { type: Number, default: 0 },
  },
];

export const Purchase = make("Purchase", {
  purchaseNo: { type: String, unique: true },
  kind: { type: String, enum: ["gold", "jewellery", "tool"], required: true },
  entryType: { type: String, enum: ["purchase", "opening"], default: "purchase" }, // opening = stock already with the shop
  supplier: { type: String, default: "" },
  supplierId: ref("Worker", { default: null }),
  invoiceNo: { type: String, default: "" },
  date: { type: Date, default: Date.now },
  itemName: { type: String, default: "" },
  size: { type: String, default: "" }, // tools: size / model
  quantity: { type: Number, default: 0 },
  weight: { type: Number, default: 0 },
  purity: { type: Number, default: 0 },
  rate: { type: Number, default: 0 }, // gold / jewellery: per gram, tool: per unit
  amount: { type: Number, default: 0 },
  location: { type: String, default: "" },
  pieces: [
    {
      tag: String,
      name: String,
      product: String,
      grossWeight: Number,
      stoneWeight: { type: Number, default: 0 },
      weight: Number,
      purity: Number,
    },
  ],
  notes: { type: String, default: "" },
  status,
  createdBy: ref("User"),
});

export const Job = make("Job", {
  jobNo: { type: String, unique: true },
  workerReceiptNo: { type: String, default: "" },
  owner: { type: String, enum: ["own", "customer"], required: true },
  customer: ref("Customer", { default: null }),
  worker: ref("Worker", { required: true }),
  product: { type: String, default: "" },
  date: { type: Date, default: Date.now },
  issuedWeight: Number,
  issuedPurity: Number,
  status: {
    type: String,
    enum: ["issued", "completed", "cancelled"],
    default: "issued",
  },
  receivedAt: Date,
  pieces: [
    {
      name: String,
      product: String,
      grossWeight: Number,
      stoneWeight: { type: Number, default: 0 },
      weight: Number,
      purity: Number,
    },
  ],
  finishedWeight: { type: Number, default: 0 },
  scrapWeight: { type: Number, default: 0 },
  wastage: { type: Number, default: 0 },
  makingChargeType: {
    type: String,
    enum: ["per_gram", "fixed"],
    default: "per_gram",
  },
  makingChargeValue: { type: Number, default: 0 },
  makingCharge: { type: Number, default: 0 }, // before the offer
  offerType: { type: String, enum: ["amount", "percent"], default: "amount" },
  offerValue: { type: Number, default: 0 }, // rupees or percent, as typed
  offerAmount: { type: Number, default: 0 }, // offer in rupees
  taxableValue: { type: Number, default: 0 }, // making charge - offer
  taxRate: ref("TaxRate", { default: null }),
  taxes: taxLines,
  gstRate: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  totalCharge: { type: Number, default: 0 },
  invoiceNo: { type: String, default: "" },
  invoiceDate: Date,
  delivered: { type: Boolean, default: false },
  deliveredAt: Date,
  notes: { type: String, default: "" },
  createdBy: ref("User"),
});

export const Payment = make("Payment", {
  receiptNo: { type: String, unique: true },
  job: ref("Job", { required: true }),
  customer: ref("Customer", { required: true }),
  amount: { type: Number, required: true },
  mode: {
    type: String,
    enum: ["cash", "upi", "bank", "cheque", "other"],
    default: "cash",
  },
  date: { type: Date, default: Date.now },
  notes: { type: String, default: "" },
  status,
  createdBy: ref("User"),
});

export const Jewellery = make("Jewellery", {
  tag: { type: String, unique: true },
  owner: { type: String, enum: ["own", "customer"], required: true },
  customer: ref("Customer", { default: null }),
  job: ref("Job"),
  name: String,
  product: { type: String, default: "General" },
  grossWeight: { type: Number, default: 0 },
  stoneWeight: { type: Number, default: 0 },
  weight: Number,
  purity: Number,
  location: { type: String, default: "Shop" },
  status: {
    type: String,
    enum: ["in_stock", "sold", "delivered", "void"],
    default: "in_stock",
  },
  sale: ref("Sale", { default: null }),
  purchase: ref("Purchase", { default: null }),
});

export const Sale = make("Sale", {
  invoiceNo: { type: String, unique: true },
  date: { type: Date, default: Date.now },
  buyerName: { type: String, default: "Walk-in" },
  buyerMobile: { type: String, default: "" },
  items: [
    {
      jewellery: ref("Jewellery"),
      tag: String,
      name: String,
      weight: Number,
      purity: Number,
      amount: Number,
    },
  ],
  subtotal: Number,
  gstRate: { type: Number, default: 0 },
  taxes: taxLines,
  gstAmount: { type: Number, default: 0 },
  total: Number,
  mode: { type: String, default: "cash" },
  notes: { type: String, default: "" },
  status,
  createdBy: ref("User"),
});
