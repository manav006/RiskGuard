import Razorpay from 'razorpay';
import { getMockPayments } from './razorpayMockData.js';

const keyId = process.env.RAZORPAY_KEY_ID || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

export const isConfigured = Boolean(keyId && keySecret);

let razorpayInstance = null;

if (isConfigured) {
  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export async function getTestPayments() {
  // Real Razorpay SDK code path — activates automatically when API keys are present
  if (isConfigured && razorpayInstance) {
    try {
      const response = await razorpayInstance.payments.all({ count: 20 });
      return { source: 'live', payments: response.items || [] };
    } catch (err) {
      console.error('Razorpay live call failed, falling back to mock data:', err.message);
    }
  }

  // Mock fallback — schema-accurate simulated data
  return { source: 'mock', payments: getMockPayments() };
}
