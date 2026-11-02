import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { UPLOAD_DIR } from "./auth.js";
import { User } from "./models.js";
import adminRoutes from "./routes/admin.js";
import masterRoutes from "./routes/masters.js";
import operationRoutes from "./routes/operations.js";
import insightRoutes from "./routes/insights.js";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing in .env");
  process.exit(1);
}

const app = express();
app.use(
  cors({
    origin: (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(","),
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, db: mongoose.connection.readyState === 1 }),
);
app.use("/api", adminRoutes);
app.use("/api", masterRoutes);
app.use("/api", operationRoutes);
app.use("/api", insightRoutes);

app.use("/api", (_req, res) =>
  res.status(404).json({ message: "Route not found" }),
);

// one place that turns every error into { message, errors } (what the React UI reads)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.name === "ValidationError") {
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, [v.message]]),
    );
    return res
      .status(422)
      .json({ message: Object.values(errors)[0][0], errors });
  }
  if (err.name === "CastError")
    return res.status(422).json({ message: `Invalid ${err.path}` });
  if (err.code === 11000)
    return res
      .status(422)
      .json({
        message: `${Object.keys(err.keyPattern || { value: 1 })[0]} already exists`,
      });
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(422).json({ message: "Image must be 3 MB or smaller" });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res
    .status(status)
    .json({
      message: status === 500 ? "Server error" : err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    });
});

const port = process.env.PORT || 5000;
/** one-time upgrade for accounts created before User ID login: userId = part of the email before @ */
async function upgradeUsers() {
  const col = User.collection;
  const taken = new Set(
    (
      await col
        .find({ userId: { $type: "string" } }, { projection: { userId: 1 } })
        .toArray()
    ).map((x) => x.userId),
  );
  for (const u of await col
    .find({
      $or: [{ userId: { $exists: false } }, { userId: null }, { userId: "" }],
    })
    .toArray()) {
    const base =
      String(u.email || u.name || "user")
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "")
        .slice(0, 24) || "user";
    let id = base.length >= 3 ? base : `${base}user`;
    let n = 1;
    while (taken.has(id)) id = `${base}${(n += 1)}`;
    taken.add(id);
    await col.updateOne({ _id: u._id }, { $set: { userId: id } });
    console.log(`User ${u.name}: sign-in User ID set to "${id}"`);
  }
  await col.updateMany({ email: "" }, { $unset: { email: "" } });
  await User.syncIndexes(); // email becomes optional (sparse unique), userId unique
}

mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mg_arts")
  .then(() => upgradeUsers())
  .then(() =>
    app.listen(port, () =>
      console.log(`MG Arts API running on http://localhost:${port}/api`),
    ),
  )
  .catch((e) => {
    console.error("MongoDB connection failed:", e.message);
    process.exit(1);
  });
