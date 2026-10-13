// Where to go after signing in: the page that sent the visitor here
// (e.g. the booking form), otherwise the home page for their role
function destinationFor(role) {
	const back = UI.safeRedirect(new URLSearchParams(location.search).get("redirect"));
	if (role === "manager") return "/pages/manager.html";
	if (role === "staff") return "/pages/staff.html";
	return back || "/pages/browserooms.html";
}

document.addEventListener("DOMContentLoaded", function () {
	const redirect = UI.safeRedirect(new URLSearchParams(location.search).get("redirect"));
	if (redirect) {
		document.getElementById("redirect-note").hidden = false;
		// Keep the return trip if they create an account instead
		document.getElementById("register-link").href = `./register.html?redirect=${encodeURIComponent(redirect)}`;
	}

	document.getElementById("login-form").addEventListener("submit", (e) => {
		e.preventDefault();
		handleLogin();
	});

	const token = localStorage.getItem("token");
	if (token) {
		// Already signed in with a valid token - skip the form
		fetch("/auth/verify", { headers: { Authorization: "Bearer " + token } })
			.then((res) => {
				if (res.ok) location.href = destinationFor(localStorage.getItem("role"));
				else localStorage.clear();
			})
			.catch(() => localStorage.clear());
	}
});

const descs = {
	customer: "Book rooms, manage stays, leave reviews.",
	staff: "Manage bookings, check-ins and guest requests.",
	manager: "Full access to rooms, staff and reports.",
};

function setRole(role, btn) {
	document.querySelectorAll(".role-btn").forEach((b) => {
		b.classList.remove("active");
		b.setAttribute("aria-pressed", "false");
	});
	btn.classList.add("active");
	btn.setAttribute("aria-pressed", "true");
	document.getElementById("roleDesc").textContent = descs[role];
}

function autofill(email, password, role) {
	document.getElementById("email").value = email;
	document.getElementById("password").value = password;
	const roles = ["customer", "staff", "manager"];
	setRole(role, document.querySelectorAll(".role-btn")[roles.indexOf(role)]);
	document.getElementById("signin-btn").focus();
}

function showLoginError(message) {
	const el = document.getElementById("errorMsg");
	el.textContent = message;
	el.style.display = message ? "block" : "none";
}

async function handleLogin() {
	const email = document.getElementById("email");
	const password = document.getElementById("password");
	const button = document.getElementById("signin-btn");
	showLoginError("");
	email.removeAttribute("aria-invalid");
	password.removeAttribute("aria-invalid");

	if (!email.value.trim()) {
		email.setAttribute("aria-invalid", "true");
		email.focus();
		return showLoginError("Enter your email address.");
	}
	if (!password.value) {
		password.setAttribute("aria-invalid", "true");
		password.focus();
		return showLoginError("Enter your password.");
	}

	button.disabled = true;
	button.textContent = "Signing in…";
	try {
		const res = await fetch("/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: email.value.trim(), password: password.value }),
		});
		const data = await res.json();

		if (!res.ok) {
			password.setAttribute("aria-invalid", "true");
			password.select();
			return showLoginError(
				res.status === 401 ? "That email and password don't match. Check them and try again." : data.error || "Sign-in failed.",
			);
		}

		localStorage.setItem("token", data.token);
		localStorage.setItem("role", data.role);
		localStorage.setItem("name", data.name);
		location.href = destinationFor(data.role);
	} catch {
		showLoginError("We couldn't reach the server. Check your connection and try again.");
	} finally {
		button.disabled = false;
		button.textContent = "Sign in";
	}
}
