// Loads the shared footer once the page structure is ready
document.addEventListener("DOMContentLoaded", async function () {
	const footer = document.getElementById("footer");
	if (!footer) return;
	try {
		const response = await fetch("/pages/footer.html");
		footer.innerHTML = await response.text();
		// Staff stay on their console, so no links to the rest of the site
		if (localStorage.getItem("role") === "staff") {
			footer.querySelectorAll("a").forEach((link) => link.closest("div")?.remove());
		}
	} catch {
		// offline - the page still works without the footer
	}
});
