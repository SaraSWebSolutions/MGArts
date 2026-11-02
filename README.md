# MG Arts – Gold & Jewellery Management

React.js (same UI as PPC Karur) + Node.js/Express + MongoDB.

## Run

    # 1. MongoDB must be running (local or Atlas)
    cd backend
    npm install
    npm run seed:demo        # roles, admin user, tax rates + sample data (use `npm run seed` for no sample data)
    npm run dev              # API -> http://localhost:5000/api

    # 2. new terminal
    cd frontend
    npm install
    npm run dev              # UI  -> http://localhost:5173

Login: **admin@mgarts.com / Admin@123**  (change in `backend/.env` before seeding)

## How the stock rules from the client notes are enforced

| Client requirement | Where |
|---|---|
| Two stocks (own / customer) | Every gram is a row in one `Ledger` (`owner = own | customer`, customer id mandatory for customer rows). Balances are always calculated per owner / customer / purity – they can never mix (`backend/src/stock.js`). |
| Customer gives 24K bar / old gold | **Customer Gold** page → Customer Stock |
| 24K → 22K conversion | **Gold Conversion**: 22K weight = weight × 999 ÷ 916 (rule is purity based, base purity in Settings). History kept, can be voided |
| Make jewellery from it | **Job Work**: issue gold to worker → receive jewellery + scrap → wastage auto-calculated → deliver to customer |
| 3 documents for the customer | Worker receipt (Job Work), GST invoice + Payment receipt (Billing & Payments) – print / save as PDF |
| Customer pays only making charge + GST | **Billing & Payments**: per-gram or fixed charge, GST from **Tax Rates**, part payments, balance |
| Own gold purchase, own jewellery, sell in shop | **Purchases** → Own Stock → Job Work (own) → **Own Sales** |
| Tools purchase | **Purchases → Tools & equipment** (register, no gold stock) |
| Reports | Job reconciliation, customer stock, own stock, worker summary, making charges & GST (CSV export) |
| Controls | Stock can never go negative · double-click / duplicate entries blocked · receive only once · no editing of posted stock (void creates reversing entries) · role-based permissions |

## Please confirm with the client / CA
* GST rates seeded in **Tax Rates** (5% making, 3% sale) and SAC `9988` are examples – edit them to the correct values.
* Invoice shows CGST+SGST; add IGST logic if they bill other-state customers.
