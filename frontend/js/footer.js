// Loads the shared footer once the page structure is ready
document.addEventListener("DOMContentLoaded", async function () {
	const footer = document.getElementById("footer");
	if (!footer) return;
	try {
		const response = await fetch("/pages/footer.html");
		footer.innerHTML = await response.text();
	} catch {
		// offline - the page still works without the footer
	}
});
