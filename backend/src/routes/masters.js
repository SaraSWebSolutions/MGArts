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
import { auth, can, publicUrl, upload } from "../auth.js";
import {
  HttpError,
  bad,
  h,
  isId,
  listPage,
  nextNumber,
  pageOf,
  rx,
  searchOf,
} from "../utils.js";
import { getSettings } from "../ops.js";

const router = Router();
router.use(auth);

/** list / get / create / update / delete for a simple master */
function crud(
  path,
  Model,
  { perm, prefix, fields, inUse, fix, after, searchFields = ["name"] },
) {
  const pick = (body) =>
    Object.fromEntries(
      fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]),
    );
  /* ?page=&limit=&search=&status= -> paginated; no ?page -> full list (dropdowns) */
  router.get(
    `/${path}`,
    h(async (req, res) => {
      const f = {};
      const term = searchOf(req.query);
      if (term) f.$or = searchFields.map((k) => ({ [k]: rx(term) }));
      if (["0", "1"].includes(req.query.status))
        f.status = Number(req.query.status);
      if (req.query.kind && Model.schema.path("kind"))
        f.kind = String(req.query.kind);
      const out = await listPage(Model, f, req);
      if (pageOf(req.query).paged)
        out.summary = {
          total: await Model.countDocuments(),
          active: await Model.countDocuments({ status: 1 }),
        };
      res.json(out);
    }),
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
  searchFields: ["name", "code", "mobile", "gstin", "address"],
  fields: ["name", "mobile", "address", "gstin", "status"],
  fix: status,
  inUse: async (d) =>
    (await Ledger.exists({ customer: d._id })) ||
    (await Job.exists({ customer: d._id })),
});
crud("workers", Worker, {
  perm: "workers-manage",
  prefix: "WRK",
  searchFields: ["name", "code", "mobile", "kind", "address"],
  fields: ["name", "kind", "mobile", "address", "status"],
  fix: status,
  inUse: async (d) =>
    (await Ledger.exists({ worker: d._id })) ||
    (await Job.exists({ worker: d._id })),
});
crud("tax-rates", TaxRate, {
  perm: "settings-manage",
  searchFields: ["name", "type"],
  fields: ["name", "rate", "type", "isDefault", "status"],
  fix: (d) => {
    num("rate")(d);
    status(d);
    if (d.isDefault !== undefined)
      d.isDefault =
        d.isDefault === true || d.isDefault === "true" || d.isDefault === "1";
  },
});

/** settings as sent to the UI: `logo` becomes a full image URL (or null = default MG Arts logo) */
const fmtSettings = (req, s) => ({ ...s.toJSON(), logo: publicUrl(req, s.logo) });

router.get(
  "/settings",
  h(async (req, res) => res.json({ data: fmtSettings(req, await getSettings()) })),
);
/* invoice header image: upload (multipart field "logo") / remove */
router.post(
  "/settings/logo",
  can("settings-manage"),
  upload.single("logo"),
  h(async (req, res) => {
    if (!req.file) throw bad("Choose an image to upload");
    const s = await getSettings();
    s.logo = req.file.filename;
    await s.save();
    res.json({ data: fmtSettings(req, s) });
  }),
);
router.delete(
  "/settings/logo",
  can("settings-manage"),
  h(async (req, res) => {
    const s = await getSettings();
    s.logo = "";
    await s.save();
    res.json({ data: fmtSettings(req, s) });
  }),
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
    await s.save();
    res.json({ data: fmtSettings(req, s) });
  }),
);

/* tools & equipment are a purchase register - listed here for convenience */
router.get(
  "/tools",
  h(async (req, res) =>
    res.json(
      await listPage(Purchase, { kind: "tool" }, req, { sort: { date: -1 } }),
    ),
  ),
);

export default router;
