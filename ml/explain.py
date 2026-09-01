"""
Loads the trained model, computes SHAP values on the test set, and produces
human-readable reason codes for flagged transactions.
"""
import json
import joblib
import numpy as np
import pandas as pd
import shap
import xgboost as xgb

FEATURES = joblib.load("feature_list.pkl")

model = xgb.XGBClassifier()
model.load_model("fraud_model.json")

results = pd.read_csv("test_predictions.csv")

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(results[FEATURES])

FEATURE_LABELS = {
    "amount": "transaction amount",
    "hour_of_day": "time of transaction",
    "device_age_days": "device age",
    "customer_account_age_days": "account age",
    "ip_country_mismatch": "IP/billing country mismatch",
    "billing_shipping_mismatch": "billing/shipping address mismatch",
    "velocity_txns_last_hour": "transaction velocity (last hour)",
    "amount_vs_customer_avg_ratio": "amount vs. customer's usual spend",
    "payment_method_risk_score": "payment method risk score",
    "cod_to_prepaid_flip": "sudden switch from COD to prepaid",
    "new_payment_instrument": "new/unrecognized payment instrument",
    "failed_attempts_before_success": "failed payment attempts before success",
}

def top_reasons(row_idx, n=3):
    vals = shap_values[row_idx]
    order = np.argsort(-np.abs(vals))[:n]
    reasons = []
    for i in order:
        feat = FEATURES[i]
        contribution = vals[i]
        direction = "increased" if contribution > 0 else "decreased"
        reasons.append({
            "feature": feat, "label": FEATURE_LABELS[feat],
            "value": float(results.iloc[row_idx][feat]),
            "shap_contribution": round(float(contribution), 4),
            "direction": direction,
        })
    return reasons

flagged = results[results.predicted_fraud == 1].copy()
explanations = []
for idx in flagged.index:
    reasons = top_reasons(idx)
    explanations.append({
        "order_id": results.iloc[idx]["order_id"],
        "merchant_id": results.iloc[idx]["merchant_id"],
        "fraud_probability": round(float(results.iloc[idx]["fraud_probability"]), 4),
        "actual_fraud": int(results.iloc[idx]["actual_fraud"]),
        "predicted_fraud": int(results.iloc[idx]["predicted_fraud"]),
        "outcome": "true_positive" if results.iloc[idx]["actual_fraud"] == 1 else "false_positive",
        "top_reasons": reasons,
    })

with open("explanations.json", "w") as f:
    json.dump(explanations, f, indent=2)

print(f"Generated explanations for {len(explanations)} flagged transactions")
