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
