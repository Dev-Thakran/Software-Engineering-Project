const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "laextravaganza_secret_2024";

// Verifies the JWT token and attaches user info to req.user
function authenticate(req, res, next) {
	const header = req.headers.authorization;
	if (!header) return res.status(401).json({ error: "No token provided" });
	const token = header.split(" ")[1];
	try {
		req.user = jwt.verify(token, SECRET);
		next();
	} catch {
		res.status(401).json({ error: "Invalid token" });
	}
}

// Checks that the logged-in user has one of the allowed roles
function requireRole(...roles) {
	return (req, res, next) => {
		if (!roles.includes(req.user?.role)) {
			return res.status(403).json({ error: "Access denied" });
		}
		next();
	};
}

module.exports = { authenticate, requireRole, SECRET };
