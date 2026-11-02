import { Router } from "express";
import {
  Customer,
  Job,
  Ledger,
  Setting,
  TaxRate,
  Worker,
  Purchase,
} from "../models.js";
import { auth, can } from "../auth.js";
import { HttpError, bad, h, isId, nextNumber } from "../utils.js";
import { getSettings } from "../ops.js";

const router = Router();
router.use(auth);

/** list / get / create / update / delete for a simple master */
function crud(path, Model, { perm, prefix, fields, inUse, fix, after }) {
  const pick = (body) =>
    Object.fromEntries(
      fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]),
    );
  router.get(
    `/${path}`,
    h(async (_req, res) =>
      res.json({ data: await Model.find().sort({ createdAt: -1 }) }),
    ),
  );
  router.get(
    `/${path}/:id`,
    h(async (req, res) => {
      const d = isId(req.params.id) && (await Model.findById(req.params.id));
      if (!d) throw new HttpError(404, "Not found");
      res.json({ data: d });
    }),
  );
  router.post(
    `/${path}`,
    can(perm),
    h(async (req, res) => {
      const data = pick(req.body);
      if (fix) fix(data);
      if (prefix) data.code = await nextNumber(prefix, 4);
      const doc = await Model.create(data);
      if (after) await after(doc);
      res.status(201).json({ data: doc });
    }),
  );
  router.put(
    `/${path}/:id`,
    can(perm),
    h(async (req, res) => {
      const d = isId(req.params.id) && (await Model.findById(req.params.id));
      if (!d) throw new HttpError(404, "Not found");
      const data = pick(req.body);
      if (fix) fix(data);
      d.set(data);
      await d.save();
      if (after) await after(d);
      res.json({ data: d });
    }),
  );
  router.delete(
    `/${path}/:id`,
    can(perm),
    h(async (req, res) => {
      const d = isId(req.params.id) && (await Model.findById(req.params.id));
      if (!d) throw new HttpError(404, "Not found");
      if (inUse && (await inUse(d)))
        throw bad(
          "This record is already used in transactions - mark it Inactive instead of deleting",
        );
      await d.deleteOne();
      res.json({ message: "Deleted" });
    }),
  );
}

const num = (k) => (d) => {
  if (d[k] !== undefined) d[k] = Number(d[k]);
};
const status = (d) => {
  if (d.status !== undefined) d.status = Number(d.status);
};

crud("customers", Customer, {
  perm: "customers-manage",
  prefix: "CUS",
  fields: ["name", "mobile", "address", "gstin", "status"],
  fix: status,
  inUse: async (d) =>
    (await Ledger.exists({ customer: d._id })) ||
    (await Job.exists({ customer: d._id })),
});
crud("workers", Worker, {
  perm: "workers-manage",
  prefix: "WRK",
  fields: ["name", "kind", "mobile", "address", "status"],
  fix: status,
  inUse: async (d) =>
    (await Ledger.exists({ worker: d._id })) ||
    (await Job.exists({ worker: d._id })),
});
crud("tax-rates", TaxRate, {
  perm: "settings-manage",
  fields: ["name", "rate", "type", "isDefault", "status"],
  fix: (d) => {
    num("rate")(d);
    status(d);
    if (d.isDefault !== undefined)
      d.isDefault =
        d.isDefault === true || d.isDefault === "true" || d.isDefault === "1";
  },
});

router.get(
  "/settings",
  h(async (_req, res) => res.json({ data: await getSettings() })),
);
router.put(
  "/settings",
  can("settings-manage"),
  h(async (req, res) => {
    const s = await getSettings();
    for (const k of [
      "shopName",
      "address",
      "phone",
      "gstin",
      "state",
      "sacCode",
    ])
      if (req.body[k] !== undefined) s[k] = String(req.body[k]);
    for (const k of ["basePurity", "barPurity", "wastageAlertPercent"]) {
      if (req.body[k] === undefined) continue;
      const n = Number(req.body[k]);
      if (!Number.isFinite(n) || n <= 0)
        throw bad(`${k} must be a positive number`);
      s[k] = n;
    }
    res.json({ data: await s.save() });
  }),
);

/* tools & equipment are a purchase register - listed here for convenience */
router.get(
  "/tools",
  h(async (_req, res) =>
    res.json({
      data: await Purchase.find({ kind: "tool" }).sort({ date: -1 }),
    }),
  ),
);

export default router;
