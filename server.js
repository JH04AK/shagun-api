// Add this route in server.js to fetch gift info by token
app.get('/api/v1/gifts/claim/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { data, error } = await supabase
      .from('stock_gifts')
      .select('*')
      .eq('claim_token', token)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Lifafa gift not found' });
    }

    return res.json({ success: true, gift: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
