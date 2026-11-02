// Sets a new password using the one-time token from the reset link
// (reset.html?token=...), then sends the guest to sign in.
const $ = (id) => document.getElementById(id);

const RULES = {
	password: (v) => (v.length < 8 ? "Use at least 8 characters." : !v.trim() ? "A password can't be only spaces." : ""),
	confirmPassword: (v) => (v && v === $("password").value ? "" : "The passwords don't match."),
};

function checkField(id) {
	const problem = RULES[id]($(id).value);
	$(`${id}-error`).textContent = problem;
	$(id).setAttribute("aria-invalid", String(Boolean(problem)));
	return !problem;
}

// Length first: anything under 8 characters is "Too short" whatever it contains
function showStrength() {
	const value = $("password").value;
	let level = 0;
	let word = "";
	if (value && value.length < 8) {
		level = 1;
		word = "Too short";
	} else if (value) {
		level = 1;
		if (value.length >= 12) level++;
		if (/[a-z]/.test(value) && /[A-Z]/.test(value)) level++;
		if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) level++;
		level = Math.min(level, 4);
		word = ["", "Weak", "Fair", "Good", "Strong"][level];
	}
	$("strength").dataset.level = level;
	$("strength-text").textContent = value ? `Strength: ${word}` : "At least 8 characters.";
}

document.addEventListener("DOMContentLoaded", () => {
	const token = new URLSearchParams(location.search).get("token");
	if (!token) {
		$("errorMsg").textContent = "This page needs the link from your reset email. Request a new one below.";
		$("errorMsg").style.display = "block";
		$("reset-btn").disabled = true;
		return;
	}

	$("password").addEventListener("input", showStrength);
	Object.keys(RULES).forEach((id) => {
		$(id).addEventListener("blur", () => $(id).value && checkField(id));
		$(id).addEventListener("input", () => $(id).getAttribute("aria-invalid") === "true" && checkField(id));
	});

	$("reset-form").addEventListener("submit", async (e) => {
		e.preventDefault();
		const ids = Object.keys(RULES);
		const ok = ids.map(checkField);
		if (ok.includes(false)) return $(ids[ok.indexOf(false)]).focus();

		const button = $("reset-btn");
		button.disabled = true;
		button.textContent = "Saving…";
		try {
			const res = await fetch("/auth/reset", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password: $("password").value }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "We couldn't update your password.");
			localStorage.clear();
			location.href = "/pages/Login.html?reset=1";
		} catch (err) {
			$("errorMsg").textContent = err.message === "Failed to fetch" ? "We couldn't reach the server. Please try again." : err.message;
			$("errorMsg").style.display = "block";
			button.disabled = false;
			button.textContent = "Save new password";
		}
	});
});
