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

const descs = {
	customer: "Book rooms, manage stays, leave reviews.",
	staff: "Manage bookings, check-ins and guest requests.",
	manager: "Full access to rooms, staff and reports.",
};

let activeRole = "customer";

function setRole(role, btn) {
	activeRole = role;
	document
		.querySelectorAll(".role-btn")
		.forEach((b) => b.classList.remove("active"));
	btn.classList.add("active");
	document.getElementById("roleDesc").textContent = descs[role];
}

function autofill(email, password, role) {
	document.getElementById("email").value = email;
	document.getElementById("password").value = password;
	const btns = document.querySelectorAll(".role-btn");
	const roles = ["customer", "staff", "manager"];
	setRole(role, btns[roles.indexOf(role)]);
}

async function handleLogin() {
	const email = document.getElementById("email").value.trim();
	const password = document.getElementById("password").value;
	const el = document.getElementById("errorMsg");

	if (!email || !password) {
		el.textContent = "Please enter your email and password.";
		el.style.display = "block";
		return;
	}

	try {
		const res = await fetch("/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		const data = await res.json();

		if (!res.ok) {
			el.textContent = data.error || "Invalid credentials. Please try again.";
			el.style.display = "block";
			setTimeout(() => (el.style.display = "none"), 4000);
			return;
		}

		// Store token and user info
		localStorage.setItem("token", data.token);
		localStorage.setItem("role", data.role);
		localStorage.setItem("name", data.name);

		// Redirect by role
		if (data.role === "manager") window.location.href = "manager.html";
		else if (data.role === "staff") window.location.href = "staff.html";
		else window.location.href = "rooms.html";
	} catch {
		el.textContent = "Network error. Is the server running?";
		el.style.display = "block";
	}
}
