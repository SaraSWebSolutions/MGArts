import { Router } from "express";
import bcrypt from "bcryptjs";
import { Permission, Role, User } from "../models.js";
import { ADMIN_ROLE, auth, can, fmtUser, signToken, upload } from "../auth.js";
import {
  HttpError,
  bad,
  h,
  isId,
  listPage,
  pageOf,
  rx,
  searchOf,
} from "../utils.js";

const router = Router();
const withRole = (q) =>
  q.populate({ path: "role_id", populate: { path: "permissions" } });

/* ---------- auth ---------- */
router.post(
  "/login",
  h(async (req, res) => {
    const { userId, password } = req.body || {};
    if (!userId || !password) throw bad("User ID and password are required");
    const user = await withRole(
      User.findOne({ userId: String(userId).toLowerCase().trim() }),
    );
    if (!user || !(await bcrypt.compare(String(password), user.password)))
      throw new HttpError(401, "Invalid user ID or password");
    res.json({ token: signToken(user), user: fmtUser(req, user) });
  }),
);

router.post("/logout", auth, (_req, res) =>
  res.json({ message: "Signed out" }),
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERID_RE = /^[a-z0-9._-]{3,30}$/;
/** email is optional: blank removes it; otherwise it must be valid and unique */
async function applyEmail(u, raw) {
  const v = String(raw ?? "")
    .toLowerCase()
    .trim();
  if (!v) {
    u.email = undefined;
    return;
  }
  if (!EMAIL_RE.test(v)) throw bad("Enter a valid email address");
  if (await User.exists({ email: v, _id: { $ne: u._id } }))
    throw bad("This email is already used by another user");
  u.email = v;
}
async function applyUserId(u, raw) {
  const v = String(raw ?? "")
    .toLowerCase()
    .trim();
  if (!USERID_RE.test(v))
    throw bad(
      "User ID must be 3-30 characters: letters, numbers, dot, dash or underscore",
    );
  if (await User.exists({ userId: v, _id: { $ne: u._id } }))
    throw bad("This User ID is already taken");
  u.userId = v;
}
const needMobile = (u) => {
  if (!String(u.mobile_number || "").trim())
    throw bad("Mobile number is required");
};

const profilePayload = (req) => ({
  user: fmtUser(req, req.user),
  permissions: [...req.perms],
});
router.get("/profile", auth, (req, res) => res.json(profilePayload(req)));

router.post(
  "/profile/update",
  auth,
  upload.single("profile_image"),
  h(async (req, res) => {
    const { name, email, mobile_number, password, password_confirmation } =
      req.body;
    const u = await User.findById(req.user._id);
    if (name !== undefined) {
      if (!String(name).trim()) throw bad("Name is required");
      u.name = String(name).trim();
    }
    if (mobile_number !== undefined)
      u.mobile_number = String(mobile_number).trim();
    needMobile(u);
    if (email !== undefined) await applyEmail(u, email);
    if (password) {
      if (password.length < 6)
        throw bad("Password must be at least 6 characters");
      if (password !== password_confirmation)
        throw bad("Password and confirmation do not match");
      u.password = await bcrypt.hash(password, 10);
    }
    if (req.file) u.profile_image = req.file.filename;
    await u.save();
    req.user = await withRole(User.findById(u._id));
    res.json({ message: "Profile updated", ...profilePayload(req) });
  }),
);

/* ---------- users ---------- */
const userGuard = [auth, can("users-manage")];

router.get(
  "/users",
  ...userGuard,
  h(async (req, res) => {
    const f = {};
    const term = searchOf(req.query);
    if (term)
      f.$or = ["name", "userId", "email", "mobile_number"].map((k) => ({
        [k]: rx(term),
      }));
    if (isId(req.query.role)) f.role_id = req.query.role;
    const out = await listPage(User, f, req, {
      decorate: withRole,
      map: (rows) => rows.map((u) => fmtUser(req, u)),
    });
    if (pageOf(req.query).paged) out.summary = { total: await User.countDocuments() };
    res.json(out);
  }),
);
router.get(
  "/users/:id",
  ...userGuard,
  h(async (req, res) => {
    const u =
      isId(req.params.id) && (await withRole(User.findById(req.params.id)));
    if (!u) throw new HttpError(404, "User not found");
    res.json({ data: fmtUser(req, u) });
  }),
);

async function saveUser(req, res, existing) {
  const {
    name,
    userId,
    email,
    mobile_number,
    role_id,
    password,
    password_confirmation,
  } = req.body;
  const u = existing || new User();
  if (name !== undefined) u.name = String(name).trim();
  if (userId !== undefined || !existing) await applyUserId(u, userId);
  if (email !== undefined) await applyEmail(u, email);
  if (mobile_number !== undefined)
    u.mobile_number = String(mobile_number).trim();
  if (role_id !== undefined) {
    if (!isId(role_id) || !(await Role.exists({ _id: role_id })))
      throw bad("Select a valid role");
    u.role_id = role_id;
  }
  if (!u.name) throw bad("Name is required");
  needMobile(u);
  if (!existing && !password) throw bad("Password is required");
  if (password) {
    if (password.length < 6)
      throw bad("Password must be at least 6 characters");
    if (password !== password_confirmation)
      throw bad("Password and confirmation do not match");
    u.password = await bcrypt.hash(password, 10);
  }
  if (req.file) u.profile_image = req.file.filename;
  await u.save();
  res
    .status(existing ? 200 : 201)
    .json({ data: fmtUser(req, await withRole(User.findById(u._id))) });
}
router.post(
  "/users",
  ...userGuard,
  upload.single("profile_image"),
  h((req, res) => saveUser(req, res, null)),
);
router.post(
  "/users/:id",
  ...userGuard,
  upload.single("profile_image"),
  h(async (req, res) => {
    const u = isId(req.params.id) && (await User.findById(req.params.id));
    if (!u) throw new HttpError(404, "User not found");
    return saveUser(req, res, u);
  }),
);
router.delete(
  "/users/:id",
  ...userGuard,
  h(async (req, res) => {
    if (String(req.user._id) === req.params.id)
      throw bad("You cannot delete your own account");
    const u = isId(req.params.id) && (await User.findById(req.params.id));
    if (!u) throw new HttpError(404, "User not found");
    await u.deleteOne();
    res.json({ message: "User deleted" });
  }),
);

/* ---------- roles ---------- */
const roleGuard = [auth, can("roles-manage")];
router.get(
  "/roles",
  auth,
  can("roles-manage", "users-manage"),
  h(async (req, res) => {
    const term = searchOf(req.query);
    const f = term ? { $or: [{ name: rx(term) }, { description: rx(term) }] } : {};
    const out = await listPage(Role, f, req, { sort: { name: 1 } });
    if (pageOf(req.query).paged) out.summary = { total: await Role.countDocuments() };
    res.json(out);
  }),
);
router.get(
  "/roles/:id",
  ...roleGuard,
  h(async (req, res) => {
    const r = isId(req.params.id) && (await Role.findById(req.params.id));
    if (!r) throw new HttpError(404, "Role not found");
    res.json({ data: r });
  }),
);
router.post(
  "/roles",
  ...roleGuard,
  h(async (req, res) => {
    if (!req.body.name?.trim()) throw bad("Name is required");
    res
      .status(201)
      .json({
        data: await Role.create({
          name: req.body.name.trim(),
          description: req.body.description || "",
        }),
      });
  }),
);
router.put(
  "/roles/:id",
  ...roleGuard,
  h(async (req, res) => {
    const r = isId(req.params.id) && (await Role.findById(req.params.id));
    if (!r) throw new HttpError(404, "Role not found");
    if (r.name === ADMIN_ROLE && req.body.name && req.body.name !== ADMIN_ROLE)
      throw bad("The Admin role cannot be renamed");
    if (req.body.name) r.name = req.body.name.trim();
    if (req.body.description !== undefined)
      r.description = req.body.description;
    res.json({ data: await r.save() });
  }),
);
router.delete(
  "/roles/:id",
  ...roleGuard,
  h(async (req, res) => {
    const r = isId(req.params.id) && (await Role.findById(req.params.id));
    if (!r) throw new HttpError(404, "Role not found");
    if (r.name === ADMIN_ROLE) throw bad("The Admin role cannot be deleted");
    if (await User.exists({ role_id: r._id }))
      throw bad("This role is assigned to users - reassign them first");
    await r.deleteOne();
    res.json({ message: "Role deleted" });
  }),
);
router.get(
  "/roles/:id/permissions",
  ...roleGuard,
  h(async (req, res) => {
    const r =
      isId(req.params.id) &&
      (await Role.findById(req.params.id).populate("permissions"));
    if (!r) throw new HttpError(404, "Role not found");
    res.json({ data: r.permissions });
  }),
);
router.post(
  "/roles/:id/permissions",
  ...roleGuard,
  h(async (req, res) => {
    const r = isId(req.params.id) && (await Role.findById(req.params.id));
    if (!r) throw new HttpError(404, "Role not found");
    const ids = (req.body.permission_ids || []).map(String);
    if (!ids.every(isId)) throw bad("Invalid permission");
    r.permissions = ids;
    await r.save();
    res.json({ message: "Permissions updated" });
  }),
);

/* ---------- permissions ---------- */
router.get(
  "/permissions",
  auth,
  can("roles-manage"),
  h(async (req, res) => {
    const term = searchOf(req.query);
    const f = term ? { $or: [{ name: rx(term) }, { description: rx(term) }] } : {};
    const out = await listPage(Permission, f, req, { sort: { name: 1 } });
    if (pageOf(req.query).paged)
      out.summary = { total: await Permission.countDocuments() };
    res.json(out);
  }),
);
router.post(
  "/permissions",
  auth,
  can("roles-manage"),
  h(async (req, res) => {
    if (!req.body.name?.trim()) throw bad("Name is required");
    res
      .status(201)
      .json({
        data: await Permission.create({
          name: req.body.name.trim(),
          description: req.body.description || "",
        }),
      });
  }),
);
router.put(
  "/permissions/:id",
  auth,
  can("roles-manage"),
  h(async (req, res) => {
    const p = isId(req.params.id) && (await Permission.findById(req.params.id));
    if (!p) throw new HttpError(404, "Permission not found");
    if (req.body.name) p.name = req.body.name.trim();
    if (req.body.description !== undefined)
      p.description = req.body.description;
    res.json({ data: await p.save() });
  }),
);
router.delete(
  "/permissions/:id",
  auth,
  can("roles-manage"),
  h(async (req, res) => {
    const p = isId(req.params.id) && (await Permission.findById(req.params.id));
    if (!p) throw new HttpError(404, "Permission not found");
    await Role.updateMany({}, { $pull: { permissions: p._id } });
    await p.deleteOne();
    res.json({ message: "Permission deleted" });
  }),
);

export default router;
