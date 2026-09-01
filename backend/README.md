# Razorpay AI Risk Manager — Backend

Read-only Express serving layer for the AI Risk Manager dashboard. It loads the
precomputed ML outputs and evidence packets into an in-memory cache at startup and
exposes them as clean JSON REST endpoints for a React (MERN) frontend.

## Why ES modules?

`package.json` sets `"type": "module"`, so the code uses `import`/`export` syntax
instead of `require()`. ES modules are the modern standard in MERN projects.

## Setup

Run from inside `backend/`:

```bash
npm install
```

## Run

```bash
npm run dev      # start with nodemon (auto-reload on changes)
# or
npm start        # start with plain node
```

Server listens on `http://localhost:8000` by default (override with `PORT` in
`backend/.env`, see `.env.example`).

## Requirements to run

This must be run from inside `razorpay_project/` with `ml/` and `evidence_generator/`
present as sibling folders (do not move or rename them). The backend reads:

- `ml/transactions.csv`
- `ml/test_predictions.csv`
- `ml/explanations.json`
- `ml/metrics.json`
- `evidence_generator/evidence_records.json`
- `evidence_generator/evidence_packets.json`

## Endpoints

| Method & Path | Description |
|---------------|-------------|
| `GET /api/health` | Health check, returns `{ status: "ok" }` |
| `GET /api/metrics` | Full model metrics (precision, recall, f1, AUC, confusion matrix, cost analysis) |
| `GET /api/transactions?limit=50&offset=0&status=all` | Paginated test transactions; `status` = `all` / `flagged` / `clean` |
| `GET /api/transactions/:orderId` | Full detail for one order: base txn + SHAP reasons + evidence fields + evidence packet |
| `GET /api/flagged` | Flagged transactions from explanations.json, sorted by fraud_probability desc |
| `GET /api/evidence-packets` | All LLM-generated chargeback evidence packets |
| `GET /api/dashboard-summary` | Aggregated dashboard numbers for the homepage |
| `GET /api/razorpay/test-payments` | Razorpay-shaped payments — returns `source: "mock"` (schema-accurate synthetic data) or `source: "live"` (real Razorpay test payments when configured) |

## Real vs mock Razorpay integration

The backend includes a **correct, production-ready Razorpay integration** in
`services/razorpayClient.js`. It uses the official [`razorpay` npm package](https://www.npmjs.com/package/razorpay)
and calls `payments.all({ count: 20 })` exactly as the real Razorpay Payments API expects.

### Current state: mock-data fallback mode

Right now the endpoint `GET /api/razorpay/test-payments` runs in **mock mode** and returns
`schema-accurate synthetic payments` (see `services/razorpayMockData.js`) — realistic
Razorpay `Payment` entities (`pay_*` IDs, amounts in paise, INR currency, captured/failed/
authorized/refunded statuses, card/upi/netbanking/wallet methods, stats, etc.).

This is because activating a real Razorpay merchant account requires **PAN/KYC
verification**, which was not available during hackathon build time. The fallback is
**intentional and clearly labelled** — responses carry `source: "mock"` and a `message`
explaining the mode, and the frontend shows a "Demo Mode" banner. This synthetic data is
**never presented as live data** anywhere in the API or UI.

### How to switch to live Razorpay test data

No code changes are required. The endpoint auto-switches via the `isConfigured` check in
`services/razorpayClient.js`, which is `true` only when **both** environment variables are
present and non-empty:

1. Add real Razorpay **test mode** API keys to `backend/.env`:
   ```
   RAZORPAY_KEY_ID=your-real-test-key-id
   RAZORPAY_KEY_SECRET=your-real-test-key-secret
   ```
   (Get these from the Razorpay Dashboard → Settings → API Keys → Test Mode.)
2. Restart the server: `npm run dev` (or `npm start`).
3. `GET /api/razorpay/test-payments` now returns `source: "live"` with real test payments,
   and the frontend `/live` page shows a green "Connected to live Razorpay test account"
   badge instead of the mock banner.

If the live call fails even when configured (bad keys, network, etc.), the client catches
the error and falls back to mock data with a `note` field explaining that the live call
failed.

`.env.example` stays placeholder-only — real keys are never committed.

## Security note

This backend never touches `evidence_generator/.env` — that file holds a real Groq API
key used only by the Python evidence-generator scripts. The Express server makes no
calls to the Groq API and never reads or exposes that key. It only serves precomputed
data from the JSON/CSV files.
