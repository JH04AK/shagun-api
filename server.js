const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase Client using environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Root Health Check Route
app.get('/', (req, res) => {
  res.json({ status: 'active', platform: 'Shagun Fintech API' });
});

// Endpoint: Create a new Stock Gift Order
app.post('/api/v1/gifts/create', async (req, res) => {
  try {
    const { 
      sender_phone, 
      sender_name, 
      recipient_phone, 
      recipient_name, 
      stock_symbol, 
      gift_amount_inr, 
      occasion, 
      message 
    } = req.body;

    const claimToken = 'SHAGUN-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const stockPrice = 985.50; 
    const quantity = (gift_amount_inr / stockPrice).toFixed(4);

    const { data, error } = await supabase
      .from('stock_gifts')
      .insert([
        {
          sender_phone,
          sender_name,
          recipient_phone,
          recipient_name,
          stock_symbol,
          gift_amount_inr,
          quantity,
          occasion,
          message,
          claim_token: claimToken,
          status: 'PENDING'
        }
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Gift order created successfully',
      order: data[0],
      claim_url: `https://jh04ak.github.io/shagun/#/claim?token=${claimToken}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Payment Webhook Callback
app.post('/api/v1/payments/webhook', async (req, res) => {
  try {
    const { gift_id, payment_status } = req.body;

    if (payment_status === 'SUCCESS') {
      const { data, error } = await supabase
        .from('stock_gifts')
        .update({ status: 'PAID', paid_at: new Date().toISOString() })
        .eq('id', gift_id)
        .select();

      if (error) throw error;

      return res.status(200).json({ 
        success: true, 
        message: 'Payment recorded and order activated', 
        gift: data[0] 
      });
    }

    res.status(400).json({ success: false, message: 'Payment failed or pending' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Shagun API active on port ${PORT}`);
});
