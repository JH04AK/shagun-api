const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();

// Enable CORS and JSON parsing
app.use(cors({ origin: '*' }));
app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Razorpay
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

// Root Health Check Route
app.get('/', (req, res) => {
  res.json({ status: 'active', platform: 'Shagun Fintech API' });
});

// 1. Create Gift Order
app.post('/api/v1/gifts/create', async (req, res) => {
  try {
    const { sender_phone, sender_name, recipient_phone, recipient_name, stock_symbol, gift_amount_inr, occasion, message } = req.body;

    const { data, error } = await supabase
      .from('stock_gifts')
      .insert([{ sender_phone, sender_name, recipient_phone, recipient_name, stock_symbol, gift_amount_inr, occasion, message }])
      .select();

    if (error) throw error;

    const order = data[0];
    const claim_url = `https://jh04ak.github.io/shagun/claim.html?id=${order.id}`;

    return res.json({ success: true, order, claim_url });
  } catch (err) {
    console.error('Create Gift Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Create Razorpay Payment Order
app.post('/api/v1/payments/create-order', async (req, res) => {
  try {
    const { amount_inr, gift_id } = req.body;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({ success: false, error: 'Razorpay keys missing in environment' });
    }

    const options = {
      amount: Math.round(amount_inr * 100), // paise
      currency: 'INR',
      receipt: `rcpt_${gift_id.substring(0, 8)}`,
      notes: { gift_id }
    };

    const razorpayOrder = await razorpay.orders.create(options);

    return res.json({
      success: true,
      key_id: razorpayKeyId,
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency
    });
  } catch (err) {
    console.error('Razorpay Order Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Verify Payment Signature
app.post('/api/v1/payments/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, gift_id } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      await supabase
        .from('stock_gifts')
        .update({ payment_status: 'PAID', razorpay_payment_id })
        .eq('id', gift_id);

      return res.json({ success: true, message: 'Payment verified successfully!' });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }
  } catch (err) {
    console.error('Verify Payment Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all route to guarantee JSON for missing routes (avoids HTML 404 pages)
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found on server.` });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Shagun API active on port ${PORT}`));
