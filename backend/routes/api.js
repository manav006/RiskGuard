import { Router } from 'express';
import { cache } from '../data/loadData.js';
import { getTestPayments, isConfigured } from '../services/razorpayClient.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/razorpay/test-payments', async (req, res) => {
  try {
    const result = await getTestPayments();
    let message;
    if (result.source === 'live') {
      message = 'Connected to a live Razorpay test account. Showing real Razorpay test payments.';
    } else if (result.note) {
      message = result.note;
    } else {
      message = 'Showing Razorpay-schema-accurate mock data. Real Razorpay test account pending KYC activation — see README for details. Backend is fully wired to switch to live data the moment real API keys are added to .env.';
    }
    res.json({
      source: result.source,
      payments: result.payments,
      message,
      configured: isConfigured,
    });
  } catch (err) {
    console.error('Failed to fetch Razorpay test payments:', err);
    res.status(500).json({ error: 'Failed to fetch Razorpay test payments' });
  }
});

router.get('/metrics', (req, res) => {
  res.json(cache.metrics);
});

router.get('/transactions', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  const status = req.query.status || 'all';

  let filtered = cache.predictions;
  if (status === 'flagged') {
    filtered = filtered.filter((t) => t.predicted_fraud === 1 || t.predicted_fraud === true);
  } else if (status === 'clean') {
    filtered = filtered.filter((t) => t.predicted_fraud === 0 || t.predicted_fraud === false);
  }

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  res.json({ total, limit, offset, transactions: page });
});

router.get('/transactions/:orderId', (req, res) => {
  const orderId = req.params.orderId;

  const base = cache.predictions.find((t) => t.order_id === orderId);
  if (!base) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const result = { ...base };

  const explanation = cache.explanations.find((e) => e.order_id === orderId);
  if (explanation) {
    result.top_reasons = explanation.top_reasons || null;
    result.outcome = explanation.outcome || null;
    result.fraud_probability = explanation.fraud_probability ?? result.fraud_probability;
  } else {
    result.top_reasons = null;
    result.outcome = null;
  }

  const evidence = cache.evidenceRecords[orderId];
  result.evidence = {
    delivery_status: evidence?.delivery_status ?? null,
    delivery_confirmation_id: evidence?.delivery_confirmation_id ?? null,
    customer_ip_address: evidence?.customer_ip_address ?? null,
    billing_ip_match: evidence?.billing_ip_match ?? null,
    device_fingerprint_match: evidence?.device_fingerprint_match ?? null,
    customer_communication_log: evidence?.customer_communication_log ?? null,
    previous_successful_orders_count: evidence?.previous_successful_orders_count ?? null,
    avs_match: evidence?.avs_match ?? null,
  };

  const packet = cache.evidencePackets.find((p) => p.order_id === orderId);
  result.evidence_packet = packet ?? null;

  res.json(result);
});

router.get('/flagged', (req, res) => {
  const sorted = [...cache.explanations].sort(
    (a, b) => b.fraud_probability - a.fraud_probability
  );
  res.json(sorted);
});

router.get('/evidence-packets', (req, res) => {
  res.json(cache.evidencePackets);
});

router.get('/dashboard-summary', (req, res) => {
  const flaggedCount = cache.explanations.length;
  const truePositiveCount = cache.explanations.filter((e) => e.outcome === 'true_positive').length;
  const falsePositiveCount = cache.explanations.filter((e) => e.outcome === 'false_positive').length;

  const metrics = cache.metrics || {};
  const costAnalysis = metrics.cost_analysis || {};

  const actionBreakdown = {
    auto_submit_defense: 0,
    route_to_human_review: 0,
    accept_chargeback: 0,
  };
  for (const p of cache.evidencePackets) {
    const action = p.recommended_action;
    if (action in actionBreakdown) {
      actionBreakdown[action] += 1;
    }
  }

  const estimatedFraudLossPrevented =
    cache.predictions
      .filter((t) => t.actual_fraud === 1 && (t.predicted_fraud === 1 || t.predicted_fraud === true))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

  const estimatedFrictionCost =
    costAnalysis.false_positive_friction_cost_inr ?? 0;

  res.json({
    total_transactions: cache.predictions.length,
    flagged_count: flaggedCount,
    true_positive_count: truePositiveCount,
    false_positive_count: falsePositiveCount,
    model_precision: metrics.precision,
    model_recall: metrics.recall,
    evidence_packets_generated: cache.evidencePackets.length,
    action_breakdown: actionBreakdown,
    estimated_fraud_loss_prevented_inr: estimatedFraudLossPrevented,
    estimated_friction_cost_inr: estimatedFrictionCost,
  });
});

export default router;
