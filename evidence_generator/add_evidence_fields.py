"""
Synthesizes realistic supporting evidence fields for flagged transactions.

Reads ml/transactions.csv and ml/explanations.json, generates correlated evidence
fields using seeded numpy RNG, and writes evidence_records.json keyed by order_id.
"""
import json
import numpy as np
import pandas as pd
from pathlib import Path

RNG = np.random.default_rng(seed=42)

ML_DIR = Path(__file__).resolve().parent.parent / "ml"
OUTPUT_DIR = Path(__file__).resolve().parent


def load_data():
    explanations = json.loads((ML_DIR / "explanations.json").read_text())
    transactions = pd.read_csv(ML_DIR / "transactions.csv")
    return explanations, transactions


def generate_ip():
    return f"{RNG.integers(1, 224)}.{RNG.integers(0, 256)}.{RNG.integers(0, 256)}.{RNG.integers(1, 255)}"


def generate_tracking_id():
    prefix = RNG.choice(["TRK", "SHP", "DHL", "FDX", "UPS"])
    digits = "".join(RNG.choice(list("0123456789"), size=12).tolist())
    return f"{prefix}-{digits}"


def generate_support_log(rng, is_legit):
    if is_legit and rng.random() < 0.7:
        count = rng.choice([1, 2], p=[0.6, 0.4])
    elif not is_legit and rng.random() < 0.25:
        count = 1
    else:
        return []

    summaries = []
    legit_templates = [
        "Customer inquired about delivery status; tracking link sent.",
        "Customer confirmed receipt of order; no issues reported.",
        "Customer requested invoice copy; sent via email.",
        "Customer asked about return policy; provided details.",
        "Customer called to update shipping address; updated successfully.",
    ]
    fraud_templates = [
        "Customer claimed non-receipt of order; investigation pending.",
        "Customer disputed charge; stated unfamiliarity with merchant.",
    ]
    for _ in range(count):
        if is_legit:
            summaries.append(rng.choice(legit_templates))
        else:
            summaries.append(rng.choice(fraud_templates))
    return summaries


def synthesize_record(explanation, transactions_row):
    order_id = explanation["order_id"]
    actual_fraud = explanation["actual_fraud"]
    is_legit = actual_fraud == 0
    fp = explanation["fraud_probability"]

    reasons = {r["feature"]: r for r in explanation["top_reasons"]}
    ip_mismatch = bool(transactions_row.get("ip_country_mismatch", 0))
    device_age = float(transactions_row.get("device_age_days", 0))
    account_age = float(transactions_row.get("customer_account_age_days", 0))

    if is_legit:
        delivery_probs = [0.75, 0.20, 0.05]
    else:
        delivery_probs = [0.15, 0.35, 0.50]
    delivery_status = RNG.choice(
        ["delivered", "in_transit", "not_shipped"], p=delivery_probs
    )

    confirmation_id = generate_tracking_id() if delivery_status != "not_shipped" else None

    customer_ip = generate_ip()

    if ip_mismatch:
        billing_ip_match = bool(RNG.choice([0, 1], p=[0.7, 0.3]))
    else:
        billing_ip_match = bool(RNG.choice([0, 1], p=[0.2, 0.8]))

    if device_age < 7:
        device_fingerprint_match = bool(RNG.choice([0, 1], p=[0.65, 0.35]))
    elif device_age < 30:
        device_fingerprint_match = bool(RNG.choice([0, 1], p=[0.4, 0.6]))
    else:
        device_fingerprint_match = bool(RNG.choice([0, 1], p=[0.15, 0.85]))

    customer_communication_log = generate_support_log(RNG, is_legit)

    if account_age > 90:
        prev_orders = int(RNG.poisson(lam=8))
    elif account_age > 30:
        prev_orders = int(RNG.poisson(lam=3))
    elif account_age > 7:
        prev_orders = int(RNG.poisson(lam=1))
    else:
        prev_orders = int(RNG.choice([0, 0, 0, 1], p=[0.7, 0.1, 0.1, 0.1]))

    avs_risk = reasons.get("payment_method_risk_score", {}).get("value", 0.5)
    if is_legit:
        avs_probs = [0.65, 0.25, 0.10]
    else:
        avs_probs = [0.10, 0.30, 0.60]
    avs_match = RNG.choice(["full_match", "partial_match", "no_match"], p=avs_probs)

    return {
        "order_id": order_id,
        "merchant_id": explanation["merchant_id"],
        "actual_fraud": actual_fraud,
        "predicted_fraud": explanation["predicted_fraud"],
        "fraud_probability": fp,
        "outcome": explanation["outcome"],
        "delivery_status": delivery_status,
        "delivery_confirmation_id": confirmation_id,
        "customer_ip_address": customer_ip,
        "billing_ip_match": billing_ip_match,
        "device_fingerprint_match": device_fingerprint_match,
        "customer_communication_log": customer_communication_log,
        "previous_successful_orders_count": prev_orders,
        "avs_match": avs_match,
    }


def main():
    explanations, transactions = load_data()
    tx_lookup = transactions.set_index("order_id").to_dict("index")

    records = {}
    for expl in explanations:
        oid = expl["order_id"]
        row = tx_lookup.get(oid, {})
        records[oid] = synthesize_record(expl, row)

    output_path = OUTPUT_DIR / "evidence_records.json"
    output_path.write_text(json.dumps(records, indent=2))
    print(f"Generated evidence records for {len(records)} flagged transactions")
    print(f"Output: {output_path}")

    tp = sum(1 for r in records.values() if r["outcome"] == "true_positive")
    fp_count = sum(1 for r in records.values() if r["outcome"] == "false_positive")
    print(f"  True positives: {tp}")
    print(f"  False positives: {fp_count}")


if __name__ == "__main__":
    main()
