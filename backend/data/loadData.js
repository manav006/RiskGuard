import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..', '..');

const ML_DIR = path.join(ROOT, 'ml');
const EVIDENCE_DIR = path.join(ROOT, 'evidence_generator');

const NUMERIC_FIELDS_TRANSACTIONS = [
  'amount',
  'hour_of_day',
  'device_age_days',
  'customer_account_age_days',
  'ip_country_mismatch',
  'billing_shipping_mismatch',
  'velocity_txns_last_hour',
  'amount_vs_customer_avg_ratio',
  'payment_method_risk_score',
  'cod_to_prepaid_flip',
  'new_payment_instrument',
  'failed_attempts_before_success',
];

const NUMERIC_FIELDS_PREDICTIONS = [
  'amount',
  'hour_of_day',
  'device_age_days',
  'customer_account_age_days',
  'ip_country_mismatch',
  'billing_shipping_mismatch',
  'velocity_txns_last_hour',
  'amount_vs_customer_avg_ratio',
  'payment_method_risk_score',
  'cod_to_prepaid_flip',
  'new_payment_instrument',
  'failed_attempts_before_success',
  'actual_fraud',
  'predicted_fraud',
  'fraud_probability',
];

function parseCsv(filePath, numericFields) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const obj = {};
        for (const [key, value] of Object.entries(row)) {
          if (numericFields.includes(key)) {
            obj[key] = value === '' ? null : Number(value);
          } else {
            obj[key] = value;
          }
        }
        rows.push(obj);
      })
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export const cache = {
  explanations: [],
  metrics: null,
  evidenceRecords: {},
  evidencePackets: [],
  transactions: [],
  predictions: [],
};

export async function loadAllData() {
  const txPath = path.join(ML_DIR, 'transactions.csv');
  const predPath = path.join(ML_DIR, 'test_predictions.csv');
  const explanationsPath = path.join(ML_DIR, 'explanations.json');
  const metricsPath = path.join(ML_DIR, 'metrics.json');
  const evidenceRecordsPath = path.join(EVIDENCE_DIR, 'evidence_records.json');
  const evidencePacketsPath = path.join(EVIDENCE_DIR, 'evidence_packets.json');

  cache.transactions = await parseCsv(txPath, NUMERIC_FIELDS_TRANSACTIONS);
  cache.predictions = await parseCsv(predPath, NUMERIC_FIELDS_PREDICTIONS);

  cache.explanations = readJson(explanationsPath);
  cache.metrics = readJson(metricsPath);

  try {
    cache.evidenceRecords = readJson(evidenceRecordsPath);
  } catch (err) {
    console.warn('WARNING: evidence_records.json missing or unreadable, defaulting to {}');
    cache.evidenceRecords = {};
  }

  try {
    cache.evidencePackets = readJson(evidencePacketsPath);
  } catch (err) {
    console.warn('WARNING: evidence_packets.json missing or empty, defaulting to []');
    cache.evidencePackets = [];
  }

  console.log(`Loaded ${cache.transactions.length} raw transactions`);
  console.log(`Loaded ${cache.predictions.length} test predictions`);
  console.log(`Loaded ${cache.explanations.length} flagged explanations`);
  console.log(`Loaded ${Object.keys(cache.evidenceRecords).length} evidence records`);
  console.log(`Loaded ${cache.evidencePackets.length} evidence packets`);
}
