"""
Generates chargeback evidence packets using the Groq API.

Reads SHAP explanations + synthesized evidence fields, calls the LLM to draft
structured defense packets, and saves results to evidence_packets.json.
"""
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

OUTPUT_DIR = Path(__file__).resolve().parent
MAX_RECORDS = 15


def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key or api_key == "your-key-here":
        print("ERROR: GROQ_API_KEY not set.")
        print("Please create evidence_generator/.env with:")
        print("  GROQ_API_KEY=your-real-key")
        print("Get a free key at: https://console.groq.com/keys")
        sys.exit(1)

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        return client, "groq"
    except ImportError:
        pass

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
        return client, "openai"
    except ImportError:
        print("ERROR: Neither 'groq' nor 'openai' SDK installed.")
        print("Run: pip install groq openai")
        sys.exit(1)


def build_prompt(explanation, evidence_record):
    top_reasons_text = "\n".join(
        f"  - {r['label']}: value={r['value']:.4f}, "
        f"contribution={r['shap_contribution']:.4f}, direction={r['direction']}"
        for r in explanation["top_reasons"]
    )

    evidence_text = json.dumps(
        {k: v for k, v in evidence_record.items()
         if k not in ("order_id", "merchant_id", "actual_fraud",
                       "predicted_fraud", "fraud_probability", "outcome")},
        indent=2,
    )

    is_false_positive = explanation["outcome"] == "false_positive"

    fp_warning = ""
    if is_false_positive:
        fp_warning = """
CRITICAL WARNING: This transaction is a FALSE POSITIVE — the customer is LEGITIMATE
despite being flagged by our fraud model. You MUST strongly favor "route_to_human_review"
as the recommended_action. Do NOT recommend auto-submitting a defense or contesting
this chargeback, as doing so would harm a legitimate customer relationship. The evidence
fields below (delivery confirmation, device fingerprint match, customer communication,
prior order history) support the customer's legitimacy.
"""

    prompt = f"""You are an AI chargeback evidence analyst for a payment processor.
Given the transaction analysis below, produce a structured chargeback evidence packet.

ORDER ID: {explanation['order_id']}
MERCHANT ID: {explanation['merchant_id']}
FRAUD PROBABILITY: {explanation['fraud_probability']:.4f}
OUTCOME: {explanation['outcome']}
{fp_warning}
ML MODEL TOP-3 RISK REASONS:
{top_reasons_text}

SYNTHESIZED EVIDENCE FIELDS:
{evidence_text}

Respond with ONLY a JSON object (no markdown fences, no preamble, no explanation):
{{
  "order_id": "{explanation['order_id']}",
  "recommended_action": "auto_submit_defense" or "route_to_human_review" or "accept_chargeback",
  "confidence_note": "brief explanation of your confidence level",
  "evidence_summary": "2-3 sentence summary of the evidence",
  "evidence_packet": {{
    "transaction_details": "summary of the transaction and its risk profile",
    "delivery_evidence": "analysis of delivery status and confirmation",
    "identity_verification_evidence": "analysis of IP match, device fingerprint, AVS results",
    "customer_engagement_evidence": "analysis of prior orders and support interactions",
    "recommended_dispute_response": "the specific response language to use in the chargeback dispute"
  }}
}}"""

    return prompt


def parse_response(raw_text):
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start:end])
            except json.JSONDecodeError:
                pass
    return None


def main():
    records_path = OUTPUT_DIR / "evidence_records.json"
    if not records_path.exists():
        print("ERROR: evidence_records.json not found.")
        print("Run add_evidence_fields.py first.")
        sys.exit(1)

    explanations = json.loads(
        (OUTPUT_DIR.parent / "ml" / "explanations.json").read_text()
    )
    evidence_records = json.loads(records_path.read_text())

    expl_map = {e["order_id"]: e for e in explanations}

    client, sdk_type = get_groq_client()
    # Verify model string is current at console.groq.com/docs/models
    model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")

    print(f"Using {sdk_type} SDK, model: {model}")
    print(f"MAX_RECORDS limit: {MAX_RECORDS}")

    order_ids = list(evidence_records.keys())[:MAX_RECORDS]
    print(f"Processing {len(order_ids)} flagged transactions...\n")

    results = []
    success_count = 0
    action_counts = {"auto_submit_defense": 0, "route_to_human_review": 0, "accept_chargeback": 0}
    tp_example = None
    fp_example = None

    for i, oid in enumerate(order_ids):
        expl = expl_map[oid]
        evidence = evidence_records[oid]
        outcome = expl["outcome"]

        print(f"[{i+1}/{len(order_ids)}] {oid} ({outcome})...", end=" ", flush=True)

        prompt = build_prompt(expl, evidence)

        for attempt in range(3):
            try:
                if sdk_type == "groq":
                    response = client.chat.completions.create(
                        model=model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.3,
                        max_tokens=1024,
                    )
                    raw = response.choices[0].message.content
                else:
                    response = client.chat.completions.create(
                        model=model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.3,
                        max_tokens=1024,
                    )
                    raw = response.choices[0].message.content
                break
            except Exception as e:
                if "429" in str(e) or "rate" in str(e).lower():
                    wait = 2.5 * (2 ** attempt)
                    print(f"rate-limited, waiting {wait:.1f}s...", end=" ", flush=True)
                    time.sleep(wait)
                    continue
                print(f"ERROR: {e}")
                raw = None
                break
        else:
            print("FAILED (max retries)")
            raw = None

        if raw is None:
            results.append({"order_id": oid, "error": "API call failed"})
            print("SKIP")
            time.sleep(2.5)
            continue

        parsed = parse_response(raw)
        if parsed is None:
            results.append({"order_id": oid, "error": "JSON parse failed", "raw": raw})
            print("PARSE FAILED")
            time.sleep(2.5)
            continue

        parsed["evidence_fields"] = evidence
        results.append(parsed)
        action = parsed.get("recommended_action", "unknown")
        action_counts[action] = action_counts.get(action, 0) + 1
        success_count += 1

        if outcome == "true_positive" and tp_example is None:
            tp_example = parsed
        elif outcome == "false_positive" and fp_example is None:
            fp_example = parsed

        print(f"OK -> {action}")
        time.sleep(2.5)

    output_path = OUTPUT_DIR / "evidence_packets.json"
    output_path.write_text(json.dumps(results, indent=2))

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Processed:  {len(order_ids)}")
    print(f"Successes:  {success_count}")
    print(f"Failures:   {len(order_ids) - success_count}")
    print(f"\nAction breakdown:")
    for action, count in sorted(action_counts.items()):
        print(f"  {action}: {count}")

    if tp_example:
        print(f"\n--- TRUE POSITIVE EXAMPLE ({tp_example['order_id']}) ---")
        print(json.dumps(tp_example, indent=2)[:1500])

    if fp_example:
        print(f"\n--- FALSE POSITIVE EXAMPLE ({fp_example['order_id']}) ---")
        print(json.dumps(fp_example, indent=2)[:1500])

    print(f"\nOutput saved to: {output_path}")


if __name__ == "__main__":
    main()
