document.addEventListener("DOMContentLoaded", function () {
	const token = localStorage.getItem("token");
	if (token) {
		// Verify token is still valid before redirecting
		fetch("/auth/verify", {
			headers: { Authorization: "Bearer " + token },
		})
			.then((res) => {
				if (res.ok) {
					const role = localStorage.getItem("role");
					if (role === "manager") window.location.href = "/pages/manager.html";
					else if (role === "staff") window.location.href = "/pages/staff.html";
					else window.location.href = "/pages/browserooms.html";
				} else {
					// Token is invalid or expired, clear it
					localStorage.clear();
				}
			})
			.catch(() => localStorage.clear());
	}
});

async function handleRegister() {
	const fullName = document.getElementById("fullName").value.trim();
	const email = document.getElementById("email").value.trim();
	const password = document.getElementById("password").value;
	const confirm = document.getElementById("confirmPassword").value;
	const errEl = document.getElementById("errorMsg");
	const sucEl = document.getElementById("successMsg");

	errEl.style.display = "none";
	sucEl.style.display = "none";

	// Client-side validation
	if (!fullName) {
		showError("Please enter your full name.");
		return;
	}
	if (!email) {
		showError("Please enter your email.");
		return;
	}
	if (!email.includes("@")) {
		showError("Please enter a valid email.");
		return;
	}
	if (password.length < 6) {
		showError("Password must be at least 6 characters.");
		return;
	}
	if (password !== confirm) {
		showError("Passwords do not match.");
		return;
	}

	try {
		const res = await fetch("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: fullName, email, password }),
		});
		const data = await res.json();

		if (!res.ok) {
			showError(data.error || "Registration failed.");
			return;
		}

		// Show success then redirect to login
		sucEl.textContent = `Welcome, ${fullName.split(" ")[0]}! Redirecting to sign in...`;
		sucEl.style.display = "block";
		setTimeout(() => (window.location.href = "Login.html"), 1500);
	} catch {
		showError("Network error. Is the server running?");
	}
}
function showError(msg) {
	const el = document.getElementById("errorMsg");
	el.textContent = msg;
	el.style.display = "block";
	setTimeout(() => (el.style.display = "none"), 4000);
}
