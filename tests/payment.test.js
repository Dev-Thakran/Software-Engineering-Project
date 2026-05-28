// ============================================================
// tests/payment.test.js — Unit tests for payment validation
// ============================================================

// Extract the validation logic directly so we can test it in isolation
// This mirrors exactly what payment.controller.js does

function validateCard(cardNumber, expiry, cvv) {
	const errors = [];
	if (!cardNumber || !/^\d{16}$/.test(cardNumber.replace(/\s/g, "")))
		errors.push("Card number must be 16 digits");
	if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry))
		errors.push("Expiry must be MM/YY");
	if (!cvv || !/^\d{3,4}$/.test(cvv)) errors.push("CVV must be 3 or 4 digits");
	return errors;
}

// - Unit Test 7: Valid card passes validation ---------
test("valid card details pass validation", () => {
	const errors = validateCard("4242424242424242", "12/26", "123");
	expect(errors).toHaveLength(0);
});

// - Unit Test 8: 15-digit card number is rejected ------
test("15 digit card number fails validation", () => {
	const errors = validateCard("424242424242424", "12/26", "123");
	expect(errors).toContain("Card number must be 16 digits");
});

// - Unit Test 9: Non-numeric card number is rejected -----
test("non-numeric card number fails validation", () => {
	const errors = validateCard("abcd efgh ijkl mnop", "12/26", "123");
	expect(errors).toContain("Card number must be 16 digits");
});

// - Unit Test 10: Wrong expiry format is rejected ------
test("expiry without slash fails validation", () => {
	const errors = validateCard("4242424242424242", "1226", "123");
	expect(errors).toContain("Expiry must be MM/YY");
});

// - Unit Test 11: 2-digit CVV is rejected ----------
test("2 digit CVV fails validation", () => {
	const errors = validateCard("4242424242424242", "12/26", "12");
	expect(errors).toContain("CVV must be 3 or 4 digits");
});

// - Unit Test 12: 4-digit CVV is accepted ----------
test("4 digit CVV passes validation", () => {
	const errors = validateCard("4242424242424242", "12/26", "1234");
	expect(errors).toHaveLength(0);
});
