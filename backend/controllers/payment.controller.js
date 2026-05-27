// Strategy pattern: swapping this function later connects a real payment gateway
// without touching booking logic anywhere else in the codebase
function processPayment(req, res) {
	const { cardNumber, expiry, cvv, amount } = req.body;
	if (!cardNumber || !expiry || !cvv || !amount)
		return res.status(400).json({ error: "All payment fields are required" });
	if (!/^\d{16}$/.test(cardNumber.replace(/\s/g, "")))
		return res.status(400).json({ error: "Card number must be 16 digits" });
	if (!/^\d{2}\/\d{2}$/.test(expiry))
		return res.status(400).json({ error: "Expiry must be MM/YY" });
	if (!/^\d{3,4}$/.test(cvv))
		return res.status(400).json({ error: "CVV must be 3 or 4 digits" });
	// Simulate payment - always succeeds in demo mode
	res.json({ success: true, transactionId: "TXN" + Date.now(), amount });
}

module.exports = { processPayment };
