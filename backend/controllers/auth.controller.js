const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userRepo = require("../repositories/user.repository");
const { SECRET } = require("../middleware/auth.middleware");

// Register a new customer account
async function register(req, res) {
	const { name, email, password } = req.body;
	if (!name || !email || !password)
		return res.status(400).json({ error: "All fields required" });
	if (typeof name !== "string" || name.trim().length < 2 || name.length > 80)
		return res.status(400).json({ error: "Please enter your full name" });
	if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return res.status(400).json({ error: "Please enter a valid email address" });
	if (typeof password !== "string" || password.length < 8)
		return res.status(400).json({ error: "Password must be at least 8 characters" });
	if (userRepo.findByEmail(email))
		return res.status(409).json({ error: "Email already registered" });
	const hashed = await bcrypt.hash(password, 10);
	const user = {
		id: "u" + Date.now(),
		name: name.trim(),
		email: email.trim(),
		password: hashed,
		role: "customer",
	};
	userRepo.save(user);
	res.status(201).json({ message: "Account created" });
}

// Login - returns a JWT token containing id, name, and role
async function login(req, res) {
	const { email, password } = req.body;
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

module.exports = { register, login };
