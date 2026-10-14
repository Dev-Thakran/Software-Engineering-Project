const redirectTo = () => UI.safeRedirect(new URLSearchParams(location.search).get("redirect"));

document.addEventListener("DOMContentLoaded", function () {
	const back = redirectTo();
	if (back) document.getElementById("signin-link").href = `./Login.html?redirect=${encodeURIComponent(back)}`;

	const token = localStorage.getItem("token");
	if (token) {
		// Already signed in with a valid token - nothing to do here
		fetch("/auth/verify", { headers: { Authorization: "Bearer " + token } })
			.then((res) => {
				if (!res.ok) return localStorage.clear();
				const role = localStorage.getItem("role");
				location.href = role === "manager" || role === "staff" ? `/pages/${role}.html` : back || "/pages/index.html";
			})
			.catch(() => localStorage.clear());
	}

	document.getElementById("register-form").addEventListener("submit", (e) => {
		e.preventDefault();
		handleRegister();
	});
	document.getElementById("password").addEventListener("input", showStrength);
	// Check each field as the visitor leaves it, and clear errors as they fix them
	Object.keys(RULES).forEach((id) => {
		const input = document.getElementById(id);
		input.addEventListener("blur", () => input.value && checkField(id));
		input.addEventListener("input", () => input.getAttribute("aria-invalid") === "true" && checkField(id));
	});
});

const RULES = {
	fullName: (v) => (v.trim().length >= 2 ? "" : "Enter your full name."),
	email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Enter a valid email, like you@example.com."),
	password: (v) => (v.length >= 8 ? "" : "Use at least 8 characters."),
	confirmPassword: (v) => (v && v === document.getElementById("password").value ? "" : "The passwords don't match."),
};

function checkField(id) {
	const input = document.getElementById(id);
	const problem = RULES[id](input.value);
	document.getElementById(`${id}-error`).textContent = problem;
	input.setAttribute("aria-invalid", String(Boolean(problem)));
	return !problem;
}

// A simple guide to password strength: length, mixed case, numbers, symbols
function showStrength() {
	const value = document.getElementById("password").value;
	let level = 0;
	if (value.length >= 8) level++;
	if (value.length >= 12) level++;
	if (/[a-z]/.test(value) && /[A-Z]/.test(value)) level++;
	if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) level++;
	if (!value) level = 0;
	else level = Math.max(1, level);
	const words = ["", "Weak", "Fair", "Good", "Strong"];
	document.getElementById("strength").dataset.level = level;
	document.getElementById("strength-text").textContent = value ? `Strength: ${words[level]}` : "At least 8 characters.";
}

async function handleRegister() {
	const ids = Object.keys(RULES);
	const ok = ids.map(checkField);
	const firstBad = ids[ok.indexOf(false)];
	if (firstBad) return document.getElementById(firstBad).focus();

	const name = document.getElementById("fullName").value.trim();
	const email = document.getElementById("email").value.trim();
	const password = document.getElementById("password").value;
	const button = document.getElementById("register-btn");
	const errEl = document.getElementById("errorMsg");
	errEl.style.display = "none";
	button.disabled = true;
	button.textContent = "Creating your account…";

	try {
		const res = await fetch("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, email, password }),
		});
		const data = await res.json();
		if (!res.ok) {
			errEl.textContent =
				res.status === 409 ? "There's already an account with that email. Try signing in instead." : data.error || "We couldn't create the account.";
			errEl.style.display = "block";
			return;
		}

		// Sign the new guest straight in and carry on where they were going
		const login = await fetch("/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		const session = await login.json();
		if (login.ok) {
			localStorage.setItem("token", session.token);
			localStorage.setItem("role", session.role);
			localStorage.setItem("name", session.name);
			location.href = redirectTo() || "/pages/index.html";
		} else {
			location.href = "./Login.html";
		}
	} catch {
		errEl.textContent = "We couldn't reach the server. Check your connection and try again.";
		errEl.style.display = "block";
	} finally {
		button.disabled = false;
		button.textContent = "Create account";
	}
}
