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
	if (cardExpired(expiry))
		return res.status(400).json({ error: "This card has expired - check the expiry date" });
	if (!/^\d{3,4}$/.test(cvv))
		return res.status(400).json({ error: "CVV must be 3 or 4 digits" });
	// Simulate payment - always succeeds in demo mode
	res.json({ success: true, transactionId: "TXN" + Date.now(), amount });
}

// A card is valid until the end of its expiry month; months must be 01-12
function cardExpired(expiry) {
	const [month, year] = expiry.split("/").map(Number);
	if (month < 1 || month > 12) return true;
	const now = new Date();
	const thisYear = now.getFullYear() % 100;
	return year < thisYear || (year === thisYear && month < now.getMonth() + 1);
}

module.exports = { processPayment, cardExpired };
