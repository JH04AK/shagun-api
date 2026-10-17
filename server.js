// 5. Process Stock Claim Submission
app.post('/api/v1/gifts/process-claim', async (req, res) => {
  try {
    const { token, broker, demat_number } = req.body;

    if (!token || !demat_number) {
      return res.status(400).json({ success: false, error: 'Token and Demat number are required.' });
    }

    // Verify order exists
    const { data: gift, error: fetchErr } = await supabase
      .from('stock_gifts')
      .select('*')
      .eq('claim_token', token)
      .single();

    if (fetchErr || !gift) {
      return res.status(404).json({ success: false, error: 'Gift order not found.' });
    }

    if (gift.status === 'CLAIMED') {
      return res.status(400).json({ success: false, error: 'This gift has already been claimed.' });
    }

    // Update status and save recipient DP details
    const { error: updateErr } = await supabase
      .from('stock_gifts')
      .update({
        status: 'CLAIMED',
        claimed_at: new Date().toISOString(),
        recipient_broker: broker,
        recipient_demat_number: demat_number
      })
      .eq('claim_token', token);

    if (updateErr) throw updateErr;

    return res.json({ success: true, message: 'Stock gift claim recorded successfully!' });
  } catch (err) {
    console.error('Process Claim Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
