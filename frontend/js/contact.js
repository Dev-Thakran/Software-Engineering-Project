// Sends the enquiry form to Web3Forms in the background, so the guest
// stays on the page and sees a confirmation here
const WEB3FORMS_KEY = "c3ac101c-ecbd-4286-a1a4-ef836d85ecd4"; // public form key

const RULES = {
	"contact-name": (v) => (v.trim().length >= 2 ? "" : "Tell us your name."),
	"contact-email": (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Enter an email we can reply to."),
	"contact-message": (v) => (v.trim().length >= 5 ? "" : "Write a short message."),
};

function checkField(id) {
	const input = document.getElementById(id);
	const problem = RULES[id](input.value);
	document.getElementById(`${id}-error`).textContent = problem;
	input.setAttribute("aria-invalid", String(Boolean(problem)));
	return !problem;
}

document.addEventListener("DOMContentLoaded", () => {
	const form = document.getElementById("contact-form");
	const sent = document.getElementById("contact-sent");
	const error = document.getElementById("contact-error");
	const button = document.getElementById("contact-send");

	// Signed-in guests don't need to type their name
	const name = localStorage.getItem("name");
	if (name) document.getElementById("contact-name").value = name;

	Object.keys(RULES).forEach((id) => {
		const input = document.getElementById(id);
		input.addEventListener("blur", () => input.value && checkField(id));
		input.addEventListener("input", () => input.getAttribute("aria-invalid") === "true" && checkField(id));
	});

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		error.hidden = true;
		const ids = Object.keys(RULES);
		const ok = ids.map(checkField);
		if (ok.includes(false)) return document.getElementById(ids[ok.indexOf(false)]).focus();

		const data = Object.fromEntries(new FormData(form));
		button.disabled = true;
		button.textContent = "Sending…";
		try {
			const res = await fetch("https://api.web3forms.com/submit", {
				method: "POST",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify({
					access_key: WEB3FORMS_KEY,
					subject: `New enquiry (${data.topic}) – La Extravaganza`,
					...data,
				}),
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok || result.success === false) throw new Error(result.message);

			document.getElementById("contact-sent-text").textContent =
				`We'll reply to ${data.email.trim()} as soon as we can. For anything urgent, call reception on +64 9 123 4567.`;
			form.hidden = true;
			sent.hidden = false;
			sent.focus();
			form.reset();
		} catch {
			error.textContent = "We couldn't send your message just now. Please try again, or email reservations@laextravaganza.co.nz.";
			error.hidden = false;
		} finally {
			button.disabled = false;
			button.textContent = "Send enquiry";
		}
	});

	document.getElementById("contact-again").addEventListener("click", () => {
		sent.hidden = true;
		form.hidden = false;
		if (name) document.getElementById("contact-name").value = name;
		document.getElementById("contact-message").focus();
	});
});
