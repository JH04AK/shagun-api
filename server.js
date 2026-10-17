const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Health Check
app.get('/', (req, res) => {
  res.json({ status: 'active', platform: 'Shagun Fintech API' });
});

// 1. Create Stock Gift Record
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

    res.json({ success: true, order, claim_url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Create Razorpay Payment Order
app.post('/api/v1/payments/create-order', async (req, res) => {
  try {
    const { amount_inr, gift_id } = req.body;

    const options = {
      amount: Math.round(amount_inr * 100), // convert INR to Paise
      currency: 'INR',
      receipt: `rcpt_${gift_id.substring(0, 8)}`,
      notes: { gift_id }
    };

    const razorpayOrder = await razorpay.orders.create(options);

    res.json({
      success: true,
      key_id: process.env.RAZORPAY_KEY_ID,
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Verify Payment Signature & Update DB
app.post('/api/v1/payments/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, gift_id } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
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
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Shagun API running on port ${PORT}`));
