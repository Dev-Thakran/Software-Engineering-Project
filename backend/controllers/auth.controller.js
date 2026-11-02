const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userRepo = require("../repositories/user.repository");
const { SECRET } = require("../middleware/auth.middleware");

// Same password rules everywhere: at least 8 characters, not only spaces
function passwordProblem(password) {
	if (typeof password !== "string" || password.length < 8)
		return "Password must be at least 8 characters";
	if (!password.trim()) return "Password can't be only spaces";
	return null;
}

// Register a new customer account
async function register(req, res) {
	const { name, email, password } = req.body;
	if (!name || !email || !password)
		return res.status(400).json({ error: "All fields required" });
	if (typeof name !== "string" || name.trim().length < 2 || name.length > 80)
		return res.status(400).json({ error: "Please enter your full name" });
	if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return res.status(400).json({ error: "Please enter a valid email address" });
	const weak = passwordProblem(password);
	if (weak) return res.status(400).json({ error: weak });
	if (req.body.acceptTerms !== true)
		return res.status(400).json({ error: "Please agree to the Terms & Privacy Policy" });
	if (userRepo.findByEmail(email))
		return res.status(409).json({ error: "Email already registered" });
	const hashed = await bcrypt.hash(password, 10);
	const user = {
		id: "u" + Date.now(),
		name: name.trim(),
		email: email.trim(),
		password: hashed,
		role: "customer",
		termsAcceptedAt: new Date().toISOString(),
	};
	userRepo.save(user);
	res.status(201).json({ message: "Account created" });
}

// Login - returns a JWT token containing id, name, and role
async function login(req, res) {
	const { email, password } = req.body || {};
	if (typeof email !== "string" || typeof password !== "string")
		return res.status(400).json({ error: "Enter your email and password" });
	const user = userRepo.findByEmail(email);
	if (!user) return res.status(401).json({ error: "Invalid credentials" });
	const match = await bcrypt.compare(password, user.password);
	if (!match) return res.status(401).json({ error: "Invalid credentials" });
	const token = jwt.sign(
		{ id: user.id, name: user.name, role: user.role },
		SECRET,
		{ expiresIn: "8h" },
	);
	res.json({ token, role: user.role, name: user.name });
}

// ---------- Forgot / reset password ----------
// There is no email system, so in demo mode the reset link is returned to the
// page (as if it had been emailed). Set DEMO_RESET_LINKS=false in .env to stop
// that. Tokens are random, single-use and last 30 minutes; only their SHA-256
// hash is kept, in memory (a server restart clears them).
const RESET_TTL_MS = 30 * 60 * 1000;
const resetTokens = new Map(); // tokenHash -> { userId, expires }
const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

function forgotPassword(req, res) {
	const email = req.body?.email;
	const message = "If that email has an account, a reset link has been sent to it.";
	if (typeof email !== "string" || !email.trim())
		return res.status(400).json({ error: "Enter your email address" });
	const user = userRepo.findByEmail(email);
	if (!user) return res.json({ message });
	const token = crypto.randomBytes(32).toString("hex");
	resetTokens.set(hashToken(token), { userId: user.id, expires: Date.now() + RESET_TTL_MS });
	const reply = { message };
	if (process.env.DEMO_RESET_LINKS !== "false") reply.resetLink = `/pages/reset.html?token=${token}`;
	res.json(reply);
}

async function resetPassword(req, res) {
	const { token, password } = req.body || {};
	const entry = resetTokens.get(hashToken(token));
	if (!token || !entry || entry.expires < Date.now()) {
		if (entry) resetTokens.delete(hashToken(token));
		return res.status(400).json({ error: "This reset link is invalid or has expired - please request a new one" });
	}
	const weak = passwordProblem(password);
	if (weak) return res.status(400).json({ error: weak });
	const hashed = await bcrypt.hash(password, 10);
	if (!userRepo.update(entry.userId, { password: hashed }))
		return res.status(400).json({ error: "This reset link is invalid or has expired - please request a new one" });
	resetTokens.delete(hashToken(token));
	res.json({ message: "Password updated" });
}

module.exports = { register, login, forgotPassword, resetPassword };
