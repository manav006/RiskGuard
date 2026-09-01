# Evidence Generator

LLM-based chargeback evidence packet generator for the Razorpay AI Risk Manager hackathon project.

## What it does

Takes flagged transactions from the ML fraud detection layer (`ml/`) and generates structured chargeback defense evidence packets using the Groq API (free tier, no credit card required).

The pipeline:
1. `add_evidence_fields.py` — Synthesizes realistic supporting evidence fields (delivery status, IP match, device fingerprint, support logs, etc.) for each flagged transaction, correlated with actual fraud labels using seeded RNG.
2. `generate_evidence.py` — Calls the Groq LLM to draft structured chargeback defense packets combining SHAP explanations + synthesized evidence.

## How it reads ml/ outputs

- Reads `ml/transactions.csv` for transaction features (amount, device age, account age, IP mismatch, etc.)
- Reads `ml/explanations.json` for flagged transactions and their SHAP top-3 risk reasons
- **Does NOT modify any file inside ml/** — reads are strictly read-only

## Setup

1. Install dependencies:
   ```bash
   pip install groq python-dotenv
   ```

2. Copy the env template and add your real API key:
   ```bash
   cp evidence_generator/.env.example evidence_generator/.env
   ```

3. Edit `evidence_generator/.env` and replace `your-key-here` with your real Groq API key.
   Get a free key (no credit card) at: https://console.groq.com/keys

## Run order

```bash
# Step 1: Generate evidence records from ml/ data
python evidence_generator/add_evidence_fields.py

# Step 2: Generate LLM evidence packets (requires real API key in .env)
python evidence_generator/generate_evidence.py
```

## Output files

| File | Description |
|------|-------------|
| `evidence_records.json` | Synthesized evidence fields keyed by order_id |
| `evidence_packets.json` | LLM-generated chargeback defense packets |

## Known limitations

- **Synthetic evidence fields**: The evidence fields (delivery status, IP addresses, support logs, etc.) are synthetically generated and do not represent real merchant data. In production, these would come from actual order management and CRM systems.
- **MAX_RECORDS cap**: `generate_evidence.py` processes at most 15 flagged transactions per run to stay within Groq free-tier limits. Increase the `MAX_RECORDS` constant to process more (watch your rate limits).
- **Single LLM pass**: Each evidence packet is generated in a single API call. A production system would use multi-step verification and human review.
- **Model availability**: Default model is `llama-3.3-70b-versatile`. Verify the model string is current at https://console.groq.com/docs/models before running.
