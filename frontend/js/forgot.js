// Asks the server for a password reset link. There is no email system, so in
// demo mode the server hands the link back and it is shown on the page.
document.addEventListener("DOMContentLoaded", () => {
	const form = document.getElementById("forgot-form");
	const email = document.getElementById("email");
	const button = document.getElementById("forgot-btn");
	const error = document.getElementById("errorMsg");

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		error.style.display = "none";
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
			error.textContent = "Enter the email address you signed up with.";
			error.style.display = "block";
			email.setAttribute("aria-invalid", "true");
			return email.focus();
		}
		email.removeAttribute("aria-invalid");
		button.disabled = true;
		button.textContent = "Sending…";
		try {
			const res = await fetch("/auth/forgot", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.value.trim() }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "We couldn't send a reset link.");

			document.getElementById("sent-message").textContent = data.message;
			if (data.resetLink) {
				document.getElementById("reset-link").href = data.resetLink;
				document.getElementById("demo-link").hidden = false;
			}
			form.hidden = true;
			const sent = document.getElementById("sent");
			sent.hidden = false;
			sent.focus();
		} catch (err) {
			error.textContent = err.message === "Failed to fetch" ? "We couldn't reach the server. Please try again." : err.message;
			error.style.display = "block";
		} finally {
			button.disabled = false;
			button.textContent = "Send reset link";
		}
	});
});
