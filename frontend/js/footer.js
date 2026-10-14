// Loads the shared footer once the page structure is ready
document.addEventListener("DOMContentLoaded", async function () {
	const footer = document.getElementById("footer");
	if (!footer) return;
	try {
		const response = await fetch("/pages/footer.html");
		footer.innerHTML = await response.text();
		// Staff and the manager stay on their dashboards, so no links to the
		// rest of the site
		if (["staff", "manager"].includes(localStorage.getItem("role"))) {
			footer.querySelectorAll("a").forEach((link) => link.closest("div")?.remove());
		}
	} catch {
		// offline - the page still works without the footer
	}
});
