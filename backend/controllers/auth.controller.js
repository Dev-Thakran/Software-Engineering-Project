const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userRepo = require("../repositories/user.repository");
const { SECRET } = require("../middleware/auth.middleware");

// Register a new customer account
async function register(req, res) {
	const { name, email, password } = req.body;
	if (!name || !email || !password)
		return res.status(400).json({ error: "All fields required" });
	if (userRepo.findByEmail(email))
		return res.status(409).json({ error: "Email already registered" }); 
	const hashed = await bcrypt.hash(password, 10);
	const user = {
		id: "u" + Date.now(),
		name,
		email,
		password: hashed,
		role: "customer",
	};
	userRepo.save(user);
	res.status(201).json({ message: "Account created" });
}

// Login — returns a JWT token containing id, name, and role
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
