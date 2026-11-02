import { Ledger } from "./models.js";
import { bad, oid, r3 } from "./utils.js";

const bucket = (e) =>
  [e.owner, e.customer ? String(e.customer) : "", e.item, e.purity].join("|");

/** per owner / customer / item / purity balances */
export async function balanceRows(match = {}) {
  const rows = await Ledger.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          owner: "$owner",
          customer: "$customer",
          item: "$item",
          purity: "$purity",
        },
        inW: { $sum: { $cond: [{ $eq: ["$direction", "in"] }, "$weight", 0] } },
        outW: {
          $sum: { $cond: [{ $eq: ["$direction", "out"] }, "$weight", 0] },
        },
      },
    },
  ]);
  return rows.map((r) => ({
    owner: r._id.owner,
    customer: r._id.customer || null,
    item: r._id.item,
    purity: r._id.purity,
    inWeight: r3(r.inW),
    outWeight: r3(r.outW),
    balance: r3(r.inW - r.outW),
  }));
}

export async function getBalance({ owner, customer, item, purity }) {
  const match = {
    owner,
    item,
    purity,
    customer: owner === "customer" ? oid(customer) : null,
  };
  const [row] = await balanceRows(match);
  return row ? row.balance : 0;
}

/**
 * Writes ledger rows. Rules enforced here for EVERY movement:
 *  - customer stock must carry a customer id, own stock must not (no mixing)
 *  - nothing can go out of a bucket that does not hold enough
 */
export async function postLedger(entries) {
  const need = {};
  for (const e of entries) {
    if (e.owner === "customer" && !e.customer)
      throw bad("Customer stock movement needs a customer");
    if (e.owner === "own" && e.customer)
      throw bad("Own stock cannot be linked to a customer");
    if (!(e.weight > 0)) throw bad("Weight must be greater than 0");
    if (e.direction === "out")
      need[bucket(e)] = { e, w: (need[bucket(e)]?.w || 0) + e.weight };
  }
  for (const { e, w } of Object.values(need)) {
    const have = await getBalance(e);
    if (have + 1e-6 < w) {
      const who = e.owner === "own" ? "own" : "customer";
      throw bad(
        `Insufficient ${who} ${e.item} stock (purity ${e.purity}): available ${have} g, required ${r3(w)} g`,
      );
    }
  }
  return Ledger.insertMany(entries);
}

/** save a document together with its ledger rows; undo the ledger if the document fails to save */
export async function commit(doc, entries) {
  await postLedger(entries);
  try {
    await doc.save();
  } catch (err) {
    await Ledger.deleteMany({ refId: doc._id });
    throw err;
  }
  return doc;
}

export async function reverseLedger(refId, userId, note) {
  const orig = await Ledger.find({ refId, txnType: { $ne: "reversal" } });
  if (!orig.length) return;
  await postLedger(
    orig.map((e) => ({
      owner: e.owner,
      customer: e.customer,
      item: e.item,
      direction: e.direction === "in" ? "out" : "in",
      weight: e.weight,
      purity: e.purity,
      txnType: "reversal",
      refModel: e.refModel,
      refId: e.refId,
      refNo: e.refNo,
      worker: e.worker,
      date: new Date(),
      note: `Reversal: ${note}`,
      createdBy: userId,
    })),
  );
}
