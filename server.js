const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Create Razorpay Payment Order
app.post('/api/v1/payments/create-order', async (req, res) => {
  try {
    const { amount_inr, gift_id } = req.body;

    const options = {
      amount: Math.round(amount_inr * 100), // paise
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
    console.error('Razorpay Order Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Verify Payment Signature & Update Supabase
app.post('/api/v1/payments/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, gift_id } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      const { error } = await supabase
        .from('stock_gifts')
        .update({ 
          payment_status: 'PAID', 
          razorpay_payment_id: razorpay_payment_id 
        })
        .eq('id', gift_id);

      if (error) throw error;

      return res.json({ success: true, message: 'Payment verified successfully!' });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('Payment Verification Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
