# Razorpay AI Risk Manager — Fraud/Chargeback Risk ML Layer

Machine-learning layer that scores each transaction for fraud/chargeback risk and
explains *why* it was flagged. Built for the Razorpay AI Risk Manager hackathon
track. This is ML-only — no API server, database, or UI.

## What it does & why

- Generates **synthetic, merchant-shaped** transaction data (20k rows, 3.5% fraud)
  using *interpretable* features (not anonymized PCA components), so every flag can
  be explained.
- Trains an **XGBoost classifier** with **Bayesian hyperparameter tuning** (hyperopt/TPE)
  and evaluates honestly on a **held-out test set** the tuner never sees.
- Produces **SHAP-based human-readable reason codes** for every flagged transaction.

## Features (one-line each)

| Feature | Meaning |
|---------|---------|
| `amount` | Transaction amount (INR) |
| `hour_of_day` | Time of transaction (0–23) |
| `device_age_days` | How old the device is |
| `customer_account_age_days` | How old the customer account is |
| `ip_country_mismatch` | IP country ≠ billing country |
| `billing_shipping_mismatch` | Billing ≠ shipping address |
| `velocity_txns_last_hour` | # transactions this account in the last hour |
| `amount_vs_customer_avg_ratio` | Amount vs. that customer's usual spend |
| `payment_method_risk_score` | Risk score of the payment method used |
| `cod_to_prepaid_flip` | Sudden switch from COD to prepaid |
| `new_payment_instrument` | New/unrecognized payment instrument |
| `failed_attempts_before_success` | Failed attempts before the successful one |

## How to run

```bash
pip install xgboost scikit-learn pandas numpy shap hyperopt joblib
python generate_data.py   # -> transactions.csv (3.5% fraud)
python train_model.py     # -> fraud_model.json, metrics.json, test_predictions.csv
python explain.py         # -> explanations.json (reason codes for flagged txns)
```

## Final metrics (held-out test set, 5,000 rows / 175 fraud)

| Metric | Value |
|--------|-------|
| Precision | 0.5983 |
| Recall | 0.8171 |
| F1 | 0.6908 |
| AUC-ROC | 0.9407 |
| AUC-PR | 0.6589 |
| Decision threshold | 0.9022 |

**Confusion matrix:** TN 4729 · FP 96 · FN 32 · TP 143

**Cost analysis (INR)**
- False-positive friction cost: **₹14,400** (96 × ₹150 support/friction per wrongly-flagged legit txn)
- False-negative fraud loss: **₹116,146** (32 missed fraud × avg fraud amount)

## Tuned hyperparameters (Bayesian / hyperopt)

```
learning_rate: 0.0223   max_depth: 4      subsample: 0.6998
colsample_bytree: 0.9199   min_child_weight: 3   reg_alpha: 0.5006
reg_lambda: 0.0192     (n_estimators: 300, scale_pos_weight for imbalance)
```

## Explainability examples

**True positive** — `order_000794` (prob 0.93) — correctly flagged fraud:
- `payment_method_risk_score` = 0.66 → risk ↑
- `amount_vs_customer_avg_ratio` = 2.23 → risk ↑
- `velocity_txns_last_hour` = 0.0 → risk ↓ (weak)

**False positive** — `order_019654` (prob 0.96) — flagged but actually legit:
- `payment_method_risk_score` = 0.74 → risk ↑
- `amount_vs_customer_avg_ratio` = 7.07 → risk ↑
- `customer_account_age_days` = 16.6 → risk ↑ (young account drove the wrong flag)

## Known limitations

- **Synthetic data** — generated to look like Razorpay merchants, not live/full Razorpay
  transaction data. Patterns are realistic but not real production behavior.
- **Threshold tuned for 80% recall** — the 0.90 decision threshold is specific to this
  target; adjust it to trade precision vs. recall for a different business appetite.
- **SHAP = reason codes, not causal proof** — explanations show which features moved the
  model's score, not proof the transaction is fraud. Use as review guidance, not verdict.
