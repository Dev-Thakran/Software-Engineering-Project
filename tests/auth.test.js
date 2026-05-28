// ============================================================
// tests/auth.test.js — Unit tests for authentication logic
// ============================================================

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { SECRET } = require("../backend/middleware/auth.middleware");

// - Unit Test 1: bcrypt hashes password correctly ------
test("bcrypt hash is not equal to plain text password", async () => {
	const plain = "password123";
	const hashed = await bcrypt.hash(plain, 10);
	expect(hashed).not.toBe(plain);
});

// - Unit Test 2: bcrypt compare returns true for correct password -
test("bcrypt compare returns true for correct password", async () => {
	const plain = "password123";
	const hashed = await bcrypt.hash(plain, 10);
	const result = await bcrypt.compare(plain, hashed);
	expect(result).toBe(true);
});

// - Unit Test 3: bcrypt compare returns false for wrong password -
test("bcrypt compare returns false for wrong password", async () => {
	const hashed = await bcrypt.hash("password123", 10);
	const result = await bcrypt.compare("wrongpassword", hashed);
	expect(result).toBe(false);
});

// - Unit Test 4: JWT token contains correct role -------
test("JWT token contains correct user role", () => {
	const payload = { id: "u001", name: "Jane Thompson", role: "customer" };
	const token = jwt.sign(payload, SECRET, { expiresIn: "1h" });
	const decoded = jwt.verify(token, SECRET);
	expect(decoded.role).toBe("customer");
});

// - Unit Test 5: JWT token contains correct user id -----
test("JWT token contains correct user id", () => {
	const payload = { id: "u002", name: "Mike Tane", role: "staff" };
	const token = jwt.sign(payload, SECRET, { expiresIn: "1h" });
	const decoded = jwt.verify(token, SECRET);
	expect(decoded.id).toBe("u002");
});

// - Unit Test 6: JWT verify throws on invalid token -----
test("JWT verify throws error for invalid token", () => {
	expect(() => {
		jwt.verify("this.is.not.a.valid.token", SECRET);
	}).toThrow();
});
