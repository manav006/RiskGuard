# RiskGuard — AI Chargeback Risk Manager

RiskGuard is a merchant-facing fraud/chargeback risk manager that scores every Razorpay-shaped transaction for risk, explains *why* it was flagged, and drafts chargeback defense evidence — from synthetic data to model to evidence to dashboard.

---

## Problem & Track

This project targets the **Razorpay Buildathon "AI Risk Manager"** track. The challenge is to detect fraud and chargeback risk with **measured precision and recall** (not guesswork), and to make the model's decisions **explainable and bounded** rather than a black box.

RiskGuard is **defense-only** — it identifies risky transactions so a merchant can route or review them. It contains no offense-capable functionality and never acts on a transaction autonomously; flagged transactions are routed to human review.

---

## Architecture Overview

```
Synthetic Razorpay-shaped transaction data (ml/)
  → XGBoost fraud model + SHAP explainability (ml/)
  → Groq LLM chargeback evidence generator (evidence_generator/)
  → Express REST API (backend/)
  → React dashboard (frontend/)
```

Four layers with clear data flow:

1. **ml/** — Generates 20k rows of synthetic, merchant-shaped transaction data (3.5% fraud), trains a hyperparameter-tuned XGBoost classifier against a held-out test set, and produces SHAP-based reason codes for every flagged transaction.
2. **evidence_generator/** — Reads the flagged transactions and their SHAP reasons (read-only, never modifies `ml/`), synthesizes realistic supporting evidence fields, and uses the Groq LLM to draft structured chargeback defense packets.
3. **backend/** — A read-only Express REST API that loads the precomputed ML outputs and evidence packets into memory and serves them as clean JSON. Includes a **Razorpay-schema-accurate mock integration layer** (`/live` page) built on the official `razorpay` npm package, designed to auto-switch to **live Razorpay test-mode data** once real API keys are added (activation pending KYC).
4. **frontend/** — A React (Vite) dashboard visualizing flagged transactions, their SHAP explainability, honest precision/recall metrics, and the AI-drafted evidence packets.

---

## Key Results (Honest Metrics)

Numbers from the final run on the held-out test set. The model is tuned for ~80% recall, so precision and recall are reported together rather than a single rosy score.

| Metric | Value |
|--------|-------|
| Precision | 0.6087 |
| Recall | 0.80 |
| F1 | 0.6914 |
| AUC-ROC | 0.9361 |
| AUC-PR | 0.6802 |
| Decision threshold | 0.846 |
| Test set size | 5,000 rows (175 fraud) |

**Confusion matrix:** TN 4735 · FP 90 · FN 35 · TP 140

**Cost analysis (INR)**

| Item | Value |
|------|-------|
| False-positive friction cost (90 legit txns wrongly flagged @ ₹150 each) | ₹13,500 |
| False-negative fraud loss (35 missed fraud × avg fraud amount) | ₹127,035 |

The honest takeaway: catching 140 of 175 fraud cases costs 90 wrongly-flagged legitimate transactions. That friction is why flagged transactions are **gated behind human review** (see below) instead of auto-contested.

---

## Why the Explainability Is Real

**SHAP reason codes.** Every flagged transaction carries its top SHAP reasons — the actual feature values that pushed the model's risk score (e.g. `payment_method_risk_score`, `amount_vs_customer_avg_ratio`, `velocity_txns_last_hour`). This is XGBoost + SHAP on **interpretable, merchant-shaped features** — not anonymized PCA components — so the reasons read like an analyst's notes, not a vector of numbers.

**Gated, bounded, one-failure-handled-gracefully.** Transactions the model incorrectly flags (false positives) are **not** auto-contested. They are routed to **human review** with their SHAP reasons and drafted evidence shown alongside, so a merchant decides. This directly satisfies the track's "bounded and gated, one failure handled gracefully" requirement: an ML false positive becomes a human decision point, never an automatic chargeback.

---

## How to Run It Locally

The two services you actually need to see the demo are **backend/** and **frontend/**. The `ml/` and `evidence_generator/` outputs are already precomputed and committed, so those steps are optional and only needed to regenerate.

**1. ML layer (optional — outputs already exist)**

```bash
cd ml
python generate_data.py
python train_model.py
python explain.py
```

**2. Evidence generator (optional — outputs already exist)**

```bash
cd evidence_generator
python add_evidence_fields.py
python generate_evidence.py
```

Requires a `GROQ_API_KEY` in `evidence_generator/.env` (free key at https://console.groq.com/keys). Skip if you just want the demo.

**3. Backend (required)**

```bash
cd backend
npm install
npm run dev        # runs on http://localhost:8001
```

**4. Frontend (required)**

```bash
cd frontend
npm install
npm run dev        # runs on http://localhost:5173
```

Open http://localhost:5173 in a browser.

---

## Project Structure

```
razorpay_project/
├── ml/                   # ML layer: synthetic data gen, XGBoost model, SHAP explainability
├── evidence_generator/   # Groq LLM chargeback evidence packet generator
├── backend/              # Express REST API serving precomputed outputs + Razorpay mock/live integration
└── frontend/             # React/Vite merchant dashboard
```

- **ml/** — `generate_data.py` (synthetic data) → `train_model.py` (tuned XGBoost + metrics) → `explain.py` (SHAP reason codes). Committed outputs include `transactions.csv`, `metrics.json`, `explanations.json`, `test_predictions.csv`, `fraud_model.json`.
- **evidence_generator/** — `add_evidence_fields.py` (synthesizes supporting evidence fields) then `generate_evidence.py` (Groq LLM drafts defense packets). Committed outputs include `evidence_records.json` and `evidence_packets.json`.
- **backend/** — read-only Express server; in-memory cache of all precomputed outputs; REST endpoints for metrics, transactions, flagged list, evidence packets, dashboard summary, and Razorpay `/api/razorpay/test-payments`.
- **frontend/** — React dashboard with `/`, `/transactions`, and `/transactions/:orderId` pages (stat cards, SHAP explainability with false-positive callout, AI evidence packet display).

---

## Known Limitations

- **Synthetic dataset.** All ML and evidence data is generated to look like Razorpay merchants — realistic patterns, but not live production transaction behavior. Never presented as real merchant data.
- **Razorpay integration is schema-accurate mock data.** The `/live` endpoint returns realistic Razorpay-shaped payments with `source: "mock"` and a "Demo Mode" banner. Activating a real Razorpay merchant account requires **PAN/KYC verification**, which was not available during build time. The integration code is correct and uses the official `razorpay` npm package — it auto-switches to real Razorpay test-mode payments once test API keys are added, with no code changes. Until then the data is mock and clearly labelled as such.
- **Evidence packets capped at 15 records per run.** `generate_evidence.py` limits processing to respect Groq free-tier limits; the cap is a constant you can raise.
- **No authentication or database.** Read-only demo — data is loaded from committed files at startup. Not production infrastructure.

---

## Tech Stack

- **Python** — XGBoost, SHAP, hyperopt (Bayesian tuning), scikit-learn, pandas, numpy, joblib
- **Groq LLM API** — chargeback evidence packet generation (openai/gpt-oss-20b)
- **Node.js / Express** — REST backend (ES modules)
- **React / Vite** — frontend dashboard; react-router-dom, axios
- **recharts** — charting

---

### Notes

The backend and frontend are the two services required for the live demo; `ml/` and `evidence_generator/` outputs are precomputed and committed, so the Python steps are optional regeneration workflows. This is a read-only demo end to end.
