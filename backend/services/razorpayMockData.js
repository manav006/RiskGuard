// Seeded PRNG (mulberry32) for reproducible mock data — seed = 42
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function randomAlpha(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(rand() * chars.length)];
  return out;
}

function randomEmail() {
  const names = [
    'arjun.m', 'priya.s', 'rahul.k', 'ananya.p', 'vikram.d',
    'meera.r', 'siddharth.t', 'deepa.n', 'karan.j', 'neha.g',
    'amit.v', 'pooja.l', 'rohan.h', 'shruti.b', 'aditya.c',
    'kavita.w', 'manish.f', 'swati.a', 'tarun.y', 'divya.m',
  ];
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  return `${pick(names)}@${pick(domains)}`;
}

function randomPhone() {
  const prefixes = ['98', '97', '96', '90', '91', '88', '89', '85', '70', '79', '63'];
  let num = pick(prefixes);
  for (let i = 0; i < 8; i++) num += Math.floor(rand() * 10);
  return num;
}

function generateMockPayments() {
  const statuses = ['captured', 'captured', 'captured', 'captured', 'failed', 'authorized', 'refunded'];
  const methods = ['card', 'card', 'upi', 'upi', 'netbanking', 'netbanking', 'wallet'];
  const banks = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Mahindra Bank', 'Yes Bank'];
  const wallets = ['Paytm', 'PhonePe', 'Mobikwik', 'Amazon Pay'];
  const cardNetworks = ['Visa', 'Mastercard', 'RuPay', 'Amex'];

  const payments = [];

  for (let i = 0; i < 20; i++) {
    const method = pick(methods);
    const status = pick(statuses);
    const amountPaise = (Math.floor(rand() * 49) + 1) * 10000; // ₹100 – ₹5000 in steps of ₹100

    const fee = Math.round(amountPaise * 0.02); // ~2% fee
    const tax = Math.round(fee * 0.18); // 18% GST on fee

    const createdUnix = Math.floor(1700000000 + rand() * 30000000); // Nov–Dec 2023 range

    const payment = {
      id: `pay_${randomAlpha(14)}`,
      entity: 'payment',
      amount: amountPaise,
      currency: 'INR',
      status,
      order_id: `order_${randomAlpha(14)}`,
      method,
      amount_refunded: status === 'refunded' ? amountPaise : 0,
      refund_status: status === 'refunded' ? 'full' : null,
      captured: status === 'captured',
      email: randomEmail(),
      contact: randomPhone(),
      fee,
      tax,
      created_at: createdUnix,
      bank: null,
      wallet: null,
      vpa: null,
      card: null,
    };

    if (method === 'netbanking') {
      payment.bank = pick(banks);
    } else if (method === 'wallet') {
      payment.wallet = pick(wallets);
    } else if (method === 'upi') {
      const vpaProviders = ['ybl', 'okaxis', 'paytm', 'ibl', 'axl'];
      payment.vpa = `${randomAlpha(8).toLowerCase()}@${pick(vpaProviders)}`;
    } else if (method === 'card') {
      payment.card = {
        id: `card_${randomAlpha(14)}`,
        entity: 'card',
        network: pick(cardNetworks),
        type: pick(['credit', 'debit']),
        issuer: pick(banks),
        last4: String(Math.floor(rand() * 9000) + 1000),
      };
    }

    payments.push(payment);
  }

  return payments;
}

export function getMockPayments() {
  return generateMockPayments();
}
