/**
 * Removes all business / demo records so the app starts empty:
 * customers, workers, tax rates, receipts, conversions, purchases, jobs, payments, jewellery, sales, stock ledger and number counters.
 * Users, roles, permissions and shop settings are kept.
 * Usage: npm run clear:data   (asks for --yes, already included in the npm script)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Conversion, Counter, Customer, GoldReceipt, Jewellery, Job, Ledger, Payment, Purchase, Sale, TaxRate, Worker } from './models.js';

if (!process.argv.includes('--yes')) { console.log('Add --yes to confirm: this deletes all business records.'); process.exit(1); }
await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mg_arts');
for (const M of [Ledger, Sale, Jewellery, Payment, Job, Purchase, Conversion, GoldReceipt, Worker, Customer, TaxRate, Counter]) {
  const r = await M.deleteMany({});
  console.log(`${M.modelName}: ${r.deletedCount} removed`);
}
console.log('Done - users, roles and settings are untouched.');
await mongoose.disconnect();
