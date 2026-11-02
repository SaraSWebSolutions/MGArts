import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Permission, Role, Setting, User } from "./models.js";

const PERMISSIONS = [
  ["stock-view", "View stock balances and ledger"],
  ["customers-manage", "Add / edit customers"],
  ["workers-manage", "Add / edit workers and vendors"],
  ["receipts-manage", "Record customer gold receipts"],
  ["conversions-manage", "Do 24K to 22K conversions"],
  ["purchases-manage", "Own gold and tool purchases"],
  ["jobs-manage", "Issue gold, receive jewellery, deliver"],
  ["billing-manage", "Making charges, GST and payments"],
  ["sales-manage", "Sell own jewellery"],
  ["reports-view", "View reports"],
  ["settings-manage", "Shop settings and tax rates"],
  ["users-manage", "Manage users"],
  ["roles-manage", "Manage roles and permissions"],
];

await mongoose.connect(
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mg_arts",
);

for (const [name, description] of PERMISSIONS)
  await Permission.updateOne({ name }, { name, description }, { upsert: true });
const all = await Permission.find();
const staffPerms = all.filter(
  (p) => !["users-manage", "roles-manage", "settings-manage"].includes(p.name),
);
const admin = await Role.findOneAndUpdate(
  { name: "Admin" },
  { name: "Admin", description: "Full access" },
  { upsert: true, new: true },
);
await Role.findOneAndUpdate(
  { name: "Staff" },
  {
    name: "Staff",
    description: "Daily operations",
    permissions: staffPerms.map((p) => p._id),
  },
  { upsert: true },
);

const adminUserId = (process.env.ADMIN_USER_ID || "admin").toLowerCase();
if (!(await User.exists({ userId: adminUserId }))) {
  await User.create({
    userId: adminUserId,
    name: process.env.ADMIN_NAME || "MG Admin",
    mobile_number: process.env.ADMIN_MOBILE || "",
    ...(process.env.ADMIN_EMAIL
      ? { email: process.env.ADMIN_EMAIL.toLowerCase() }
      : {}),
    password: await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin@123", 10),
    role_id: admin._id,
  });
  console.log(`Admin created - User ID: ${adminUserId}`);
}
await Setting.updateOne(
  { key: "main" },
  { $setOnInsert: { key: "main", shopName: "MG ARTS" } },
  { upsert: true },
);

console.log("Seed finished");
await mongoose.disconnect();
