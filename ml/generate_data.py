"""
Generates synthetic Razorpay-merchant-shaped transaction data with realistic,
interpretable fraud/chargeback-risk patterns (not anonymized PCA components).
"""
import numpy as np
import pandas as pd

np.random.seed(42)

N = 20000
FRAUD_RATE = 0.035

n_fraud = int(N * FRAUD_RATE)
n_legit = N - n_fraud

def gen_legit(n):
    df = pd.DataFrame({
        "amount": np.random.lognormal(mean=6.5, sigma=1.0, size=n).clip(50, 200000),
        "hour_of_day": np.random.choice(range(24), n, p=_hour_probs_legit()),
        "device_age_days": np.random.exponential(scale=180, size=n).clip(0, 2000),
        "customer_account_age_days": np.random.exponential(scale=300, size=n).clip(0, 3000),
        "ip_country_mismatch": np.random.choice([0, 1], n, p=[0.97, 0.03]),
        "billing_shipping_mismatch": np.random.choice([0, 1], n, p=[0.9, 0.1]),
        "velocity_txns_last_hour": np.random.poisson(0.4, n).clip(0, 10),
        "amount_vs_customer_avg_ratio": np.random.lognormal(mean=0, sigma=0.4, size=n).clip(0.1, 8),
        "payment_method_risk_score": np.random.beta(2, 8, n),
        "cod_to_prepaid_flip": np.random.choice([0, 1], n, p=[0.95, 0.05]),
        "new_payment_instrument": np.random.choice([0, 1], n, p=[0.85, 0.15]),
        "failed_attempts_before_success": np.random.poisson(0.3, n).clip(0, 8),
    })
    df["is_fraud"] = 0
    return df

def gen_fraud(n):
    df = pd.DataFrame({
        "amount": np.random.lognormal(mean=7.5, sigma=1.3, size=n).clip(50, 200000),
        "hour_of_day": np.random.choice(range(24), n, p=_hour_probs_fraud()),
        "device_age_days": np.random.exponential(scale=5, size=n).clip(0, 2000),
        "customer_account_age_days": np.random.exponential(scale=15, size=n).clip(0, 3000),
        "ip_country_mismatch": np.random.choice([0, 1], n, p=[0.55, 0.45]),
        "billing_shipping_mismatch": np.random.choice([0, 1], n, p=[0.5, 0.5]),
        "velocity_txns_last_hour": np.random.poisson(3.5, n).clip(0, 15),
        "amount_vs_customer_avg_ratio": np.random.lognormal(mean=1.2, sigma=0.6, size=n).clip(0.1, 15),
        "payment_method_risk_score": np.random.beta(6, 3, n),
        "cod_to_prepaid_flip": np.random.choice([0, 1], n, p=[0.6, 0.4]),
        "new_payment_instrument": np.random.choice([0, 1], n, p=[0.35, 0.65]),
        "failed_attempts_before_success": np.random.poisson(2.2, n).clip(0, 8),
    })
    df["is_fraud"] = 1
    return df

def _hour_probs_legit():
    base = np.array([1,1,1,1,1,2,3,5,7,8,9,9,8,8,8,9,9,8,7,6,5,4,3,2], dtype=float)
    return base / base.sum()

def _hour_probs_fraud():
    base = np.array([6,7,8,7,6,4,3,2,2,2,2,2,2,2,2,2,3,3,4,5,6,7,8,8], dtype=float)
    return base / base.sum()

legit = gen_legit(n_legit)
fraud = gen_fraud(n_fraud)

sneaky_frac = 0.12
n_sneaky = int(len(fraud) * sneaky_frac)
sneaky_idx = fraud.sample(n=n_sneaky, random_state=1).index
legit_like = gen_legit(n_sneaky).drop(columns=["is_fraud"]).reset_index(drop=True)
for col in legit_like.columns:
    fraud.loc[sneaky_idx, col] = legit_like[col].values

risky_frac = 0.03
n_risky = int(len(legit) * risky_frac)
risky_idx = legit.sample(n=n_risky, random_state=2).index
fraud_like = gen_fraud(n_risky).drop(columns=["is_fraud"]).reset_index(drop=True)
for col in fraud_like.columns:
    legit.loc[risky_idx, col] = fraud_like[col].values

numeric_cols = ["amount", "device_age_days", "customer_account_age_days",
                 "amount_vs_customer_avg_ratio", "payment_method_risk_score"]
for d in (legit, fraud):
    for col in numeric_cols:
        noise = np.random.normal(0, d[col].std() * 0.08, size=len(d))
        d[col] = (d[col] + noise).clip(lower=0)

df = pd.concat([legit, fraud], ignore_index=True)
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

df.insert(0, "order_id", [f"order_{i:06d}" for i in range(len(df))])
df.insert(1, "merchant_id", np.random.choice([f"merch_{i:03d}" for i in range(1, 21)], len(df)))

df.to_csv("transactions.csv", index=False)
print(f"Generated {len(df)} transactions, {df['is_fraud'].sum()} fraud ({df['is_fraud'].mean()*100:.2f}%)")
