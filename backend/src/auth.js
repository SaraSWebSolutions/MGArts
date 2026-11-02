import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Permission, User } from "./models.js";
import { HttpError, h } from "./utils.js";

export const UPLOAD_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "uploads",
);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) =>
      cb(
        null,
        `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`,
      ),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(
      file.mimetype.startsWith("image/")
        ? null
        : new HttpError(422, "Only image files are allowed"),
      file.mimetype.startsWith("image/"),
    ),
});

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "12h",
  });

export const ADMIN_ROLE = "Admin";

/** Bearer token -> req.user (+ req.perms, req.isAdmin) */
export const auth = h(async (req, _res, next) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Not signed in");
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Session expired, please sign in again");
  }
  const user = await User.findById(payload.sub).populate({
    path: "role_id",
    populate: { path: "permissions" },
  });
  if (!user) throw new HttpError(401, "Account no longer exists");
  req.user = user;
  req.isAdmin = user.role_id?.name === ADMIN_ROLE;
  req.perms = new Set(
    req.isAdmin
      ? (await Permission.find()).map((p) => p.name)
      : (user.role_id?.permissions || []).map((p) => p.name),
  );
  next();
});

/** 403 unless the user has ANY of the listed permissions (Admin always passes) */
export const can =
  (...names) =>
  (req, _res, next) => {
    if (req.isAdmin || names.some((n) => req.perms.has(n))) return next();
    return next(new HttpError(403, "You do not have permission to do this"));
  };

export const publicUrl = (req, file) =>
  file ? `${req.protocol}://${req.get("host")}/uploads/${file}` : null;

export const fmtUser = (req, u) => ({
  id: String(u._id),
  userId: u.userId || "",
  name: u.name,
  email: u.email || "",
  mobile_number: u.mobile_number || "",
  profile_image: publicUrl(req, u.profile_image),
  role_id: String(u.role_id?._id || u.role_id || ""),
  role: u.role_id?.name
    ? { id: String(u.role_id._id), name: u.role_id.name }
    : null,
});
