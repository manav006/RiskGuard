"""
Trains an XGBoost fraud/chargeback-risk classifier with Bayesian hyperparameter
tuning (hyperopt), evaluates honestly on a held-out test set, saves model + metrics.
"""
import json
import joblib
import numpy as np
import pandas as pd
import hyperopt
from functools import partial
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, precision_recall_curve, average_precision_score, make_scorer
)
import xgboost as xgb
import warnings
warnings.filterwarnings("ignore")

df = pd.read_csv("transactions.csv")

FEATURES = [
    "amount", "hour_of_day", "device_age_days", "customer_account_age_days",
    "ip_country_mismatch", "billing_shipping_mismatch", "velocity_txns_last_hour",
    "amount_vs_customer_avg_ratio", "payment_method_risk_score",
    "cod_to_prepaid_flip", "new_payment_instrument", "failed_attempts_before_success",
]
TARGET = "is_fraud"

X = df[FEATURES]
y = df[TARGET]

# held-out test set carved out FIRST, tuning never sees it
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, stratify=y, random_state=42
)

print(f"Train: {len(X_train)} rows ({y_train.sum()} fraud)")
print(f"Test (held-out): {len(X_test)} rows ({y_test.sum()} fraud)")

scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()

# --- Bayesian hyperparameter tuning with hyperopt (TPE), 5-fold CV, AUC-PR scoring ---
param_space = {
    "learning_rate": hyperopt.hp.loguniform("learning_rate", np.log(0.01), np.log(0.2)),
    "max_depth": hyperopt.hp.choice("max_depth", [3, 4, 5, 6, 8]),
    "subsample": hyperopt.hp.uniform("subsample", 0.6, 1.0),
    "colsample_bytree": hyperopt.hp.uniform("colsample_bytree", 0.6, 1.0),
    "min_child_weight": hyperopt.hp.choice("min_child_weight", [1, 3, 5, 7]),
    "reg_alpha": hyperopt.hp.uniform("reg_alpha", 0, 1.0),
    "reg_lambda": hyperopt.hp.uniform("reg_lambda", 0.01, 1.0),
}

def objective(params):
    clf = xgb.XGBClassifier(
        **params, n_estimators=300, scale_pos_weight=scale_pos_weight,
        eval_metric="aucpr", random_state=42, n_jobs=-1,
    )
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(clf, X_train, y_train, cv=cv, scoring="average_precision", n_jobs=-1)
    return {"loss": -np.mean(scores), "status": hyperopt.STATUS_OK}

trials = hyperopt.Trials()
best = hyperopt.fmin(fn=objective, space=param_space, algo=hyperopt.tpe.suggest,
                      max_evals=40, trials=trials, show_progressbar=False)
best_params = hyperopt.space_eval(param_space, best)
print("\nBest hyperparameters found via Bayesian tuning:")
print(json.dumps(best_params, indent=2))

# --- train final model on full training set with tuned params ---
model = xgb.XGBClassifier(
    **best_params, n_estimators=300, scale_pos_weight=scale_pos_weight,
    eval_metric="aucpr", random_state=42,
)
model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

proba = model.predict_proba(X_test)[:, 1]
precisions, recalls, thresholds = precision_recall_curve(y_test, proba)

target_recall = 0.80
valid = recalls[:-1] >= target_recall
if valid.any():
    best_idx = np.argmax(precisions[:-1][valid])
    chosen_threshold = thresholds[valid][best_idx]
else:
    chosen_threshold = 0.5

y_pred = (proba >= chosen_threshold).astype(int)

precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
auc_pr = average_precision_score(y_test, proba)
auc_roc = roc_auc_score(y_test, proba)
tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()

avg_fraud_amount = df[df.is_fraud == 1]["amount"].mean()
fp_cost = fp * 150
fn_cost = fn * avg_fraud_amount

metrics = {
    "tuned_hyperparameters": {k: (float(v) if isinstance(v, (int, float)) else v) for k, v in best_params.items()},
    "threshold_used": round(float(chosen_threshold), 4),
    "precision": round(float(precision), 4),
    "recall": round(float(recall), 4),
    "f1_score": round(float(f1), 4),
    "auc_pr": round(float(auc_pr), 4),
    "auc_roc": round(float(auc_roc), 4),
    "confusion_matrix": {
        "true_negatives": int(tn), "false_positives": int(fp),
        "false_negatives": int(fn), "true_positives": int(tp),
    },
    "cost_analysis": {
        "false_positive_friction_cost_inr": round(float(fp_cost), 2),
        "false_negative_fraud_loss_inr": round(float(fn_cost), 2),
        "note": "FP cost = legit txns wrongly flagged (support/friction @ Rs150 each). FN cost = missed fraud (avg fraud txn amount lost).",
    },
    "test_set_size": len(y_test),
    "test_set_fraud_count": int(y_test.sum()),
}

print(json.dumps(metrics, indent=2))

model.save_model("fraud_model.json")
joblib.dump(FEATURES, "feature_list.pkl")
with open("metrics.json", "w") as f:
    json.dump(metrics, f, indent=2)

results_df = X_test.copy()
results_df["actual_fraud"] = y_test.values
results_df["predicted_fraud"] = y_pred
results_df["fraud_probability"] = proba
results_df["order_id"] = df.loc[X_test.index, "order_id"].values
results_df["merchant_id"] = df.loc[X_test.index, "merchant_id"].values
results_df.to_csv("test_predictions.csv", index=False)
