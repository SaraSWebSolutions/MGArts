import mongoose from "mongoose";
import { Counter } from "./models.js";

export class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}
export const bad = (message, errors) => new HttpError(422, message, errors);
export const h = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const oid = (v) => new mongoose.Types.ObjectId(String(v));
export const isId = (v) => mongoose.isValidObjectId(v);

export const positive = (v, name) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0)
    throw bad(`${name} must be greater than 0`);
  return n;
};
export const nonNeg = (v, name) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0) throw bad(`${name} must be 0 or more`);
  return n;
};
export const purityOf = (v, name = "Purity") => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 1000)
    throw bad(`${name} must be between 1 and 1000 (e.g. 999 = 24K, 916 = 22K)`);
  return n;
};
export const toDate = (v) => {
  if (!v) return new Date();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw bad("Invalid date");
  return d;
};

/** atomic running number: RCT-00001 */
export async function nextNumber(prefix, pad = 5) {
  const c = await Counter.findOneAndUpdate(
    { key: prefix },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `${prefix}-${String(c.seq).padStart(pad, "0")}`;
}

/** blocks an accidental double-submit of the same entry (control #26) */
export async function dupGuard(Model, filter) {
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const hit = await Model.findOne({
    ...filter,
    createdAt: { $gte: since },
    status: { $nin: ["void", "cancelled"] },
  });
  if (hit)
    throw new HttpError(
      409,
      "Duplicate entry blocked: the same details were already saved a moment ago.",
    );
}

/* ---------- pagination (server side) ----------
 * Opt-in: a list endpoint is paginated only when the request has ?page=.
 * Without it the endpoint still returns the plain list, so dropdowns that need
 * every record (customers, workers, tax rates ...) keep working.
 *   GET /customers?page=2&limit=10&search=raj
 *   -> { data: [...], meta: { page, limit, total, pages, from, to }, summary? }
 */
export const rx = (s) =>
  new RegExp(String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

export function pageOf(q = {}) {
  const paged = q.page !== undefined && q.page !== "" && q.all !== "1";
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 10, 1), 100);
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  return { paged, page, limit, skip: (page - 1) * limit };
}

export const metaOf = (total, page, limit) => ({
  page,
  limit,
  total,
  pages: Math.max(Math.ceil(total / limit), 1),
  from: total ? (page - 1) * limit + 1 : 0,
  to: Math.min(page * limit, total),
});

/** search text typed in the UI (?search=) */
export const searchOf = (q = {}) => String(q.search || "").trim();

/**
 * find + count in one go.
 * decorate(query) adds populate(); map(rows) post-processes the page of rows.
 * Not paged -> behaves like the old endpoints (legacyLimit rows, 0 = no limit).
 */
export async function listPage(
  Model,
  filter,
  req,
  { sort = { createdAt: -1 }, decorate, map, legacyLimit = 0 } = {},
) {
  const p = pageOf(req.query);
  const build = () => {
    const qr = Model.find(filter).sort(sort);
    return decorate ? decorate(qr) : qr;
  };
  if (!p.paged) {
    const rows = await build().limit(legacyLimit);
    return { data: map ? await map(rows) : rows };
  }
  const total = await Model.countDocuments(filter);
  const pages = Math.max(Math.ceil(total / p.limit), 1);
  const page = Math.min(p.page, pages); // asked past the last page (e.g. after deleting) -> last page
  const rows = await build()
    .skip((page - 1) * p.limit)
    .limit(p.limit);
  return {
    data: map ? await map(rows) : rows,
    meta: metaOf(total, page, p.limit),
  };
}

/** same idea for rows that were already calculated in memory (reports) */
export function pageRows(rows, q = {}) {
  const p = pageOf(q);
  if (!p.paged) return { rows };
  const pages = Math.max(Math.ceil(rows.length / p.limit), 1);
  const page = Math.min(p.page, pages);
  return {
    rows: rows.slice((page - 1) * p.limit, page * p.limit),
    meta: metaOf(rows.length, page, p.limit),
  };
}

/** $group helper that returns a single plain object (or zeros when nothing matches) */
export async function totals(Model, filter, group) {
  const [r] = await Model.aggregate([
    { $match: filter },
    { $group: { _id: null, ...group } },
  ]);
  return r || {};
}
