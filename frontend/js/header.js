// Escapes user-supplied text before it is inserted with innerHTML
function escapeHtml(value) {
	return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;",
	})[ch]);
}

// The header is fetched as soon as the page structure is ready (not after
// every image has loaded), so the navigation appears straight away.
document.addEventListener("DOMContentLoaded", async function () {
	addSkipLink();

	const header = document.getElementById("header");
	if (!header) return;
	try {
		const response = await fetch("/pages/header.html");
		header.innerHTML = await response.text();
	} catch {
		return; // offline - the page still works without the header
	}

	markCurrentPage();
	setUpMobileMenu();
	setUpAuth();
	document.dispatchEvent(new CustomEvent("header:ready"));
});

// "Skip to content" link for keyboard users, pointing at the first block
// after the header
function addSkipLink() {
	const target =
		document.querySelector("main") ||
		document.getElementById("header")?.nextElementSibling;
	if (!target) return;
	if (!target.id) target.id = "main-content";
	if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");

	const link = document.createElement("a");
	link.className = "skip-link";
	link.href = "#" + target.id;
	link.textContent = "Skip to content";
	document.body.prepend(link);
}

// Marks the nav link for the page being viewed
function markCurrentPage() {
	let here = window.location.pathname.toLowerCase();
	if (here === "/" || here === "/index.html") here = "/pages/index.html";
	// A single room belongs to the Rooms section
	if (here === "/pages/room.html" || here === "/pages/bookingform.html") {
		here = "/pages/browserooms.html";
	}

	document.querySelectorAll("#header nav a, #mobile-menu a").forEach((link) => {
		const path = new URL(link.href, window.location.origin).pathname.toLowerCase();
		if (path === here && !link.classList.contains("btn-reserve") && !link.classList.contains("font-serif")) {
			link.setAttribute("aria-current", "page");
		}
	});
}

function setUpMobileMenu() {
	const hamburger = document.getElementById("hamburger");
	const mobileMenu = document.getElementById("mobile-menu");
	if (!hamburger || !mobileMenu) return;

	hamburger.setAttribute("aria-controls", "mobile-menu");
	hamburger.setAttribute("aria-expanded", "false");

	const setOpen = (open) => {
		hamburger.classList.toggle("open", open);
		mobileMenu.classList.toggle("open", open);
		hamburger.setAttribute("aria-expanded", String(open));
	};

	hamburger.addEventListener("click", () => setOpen(!mobileMenu.classList.contains("open")));
	mobileMenu.addEventListener("click", (e) => {
		if (e.target.closest("a")) setOpen(false);
	});
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && mobileMenu.classList.contains("open")) {
			setOpen(false);
			hamburger.focus();
		}
	});
}

function setUpAuth() {
	const token = localStorage.getItem("token");
	const role = localStorage.getItem("role");
	const name = localStorage.getItem("name");
	const authEl = document.getElementById("nav-auth");
	if (!authEl) return;

	const userStyle = "font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;text-decoration:none;";

	if (token && name) {
		const firstName = escapeHtml(name.split(" ")[0]);
		const signOut = `<button id="nav-logout" class="nav-auth-btn" style="text-decoration:none;">Sign Out</button>`;

		if (role === "staff" || role === "manager") {
			authEl.innerHTML = `
				<a href="/pages/${role}.html" style="${userStyle}">${firstName} - Dashboard</a>
				${signOut}`;
		} else {
			authEl.innerHTML = `
				<span style="${userStyle}">${firstName}</span>
				${signOut}
				<a href="/pages/browserooms.html" class="btn-reserve">Reserve</a>`;
		}
	} else {
		authEl.innerHTML = `
			<a href="/pages/Login.html" class="nav-signin" style="${userStyle}">Sign In</a>
			<a href="/pages/browserooms.html" class="btn-reserve">Reserve</a>`;
	}

	// Mobile menu: sign in / sign out always lives in the hamburger
	const mobileAuth = document.getElementById("mobile-auth");
	if (mobileAuth) {
		mobileAuth.innerHTML = token && name
			? `<a href="#" id="mobile-logout">Sign Out</a>`
			: `<a href="/pages/Login.html">Sign In</a>`;
	}

	["nav-logout", "mobile-logout"].forEach((id) => {
		document.getElementById(id)?.addEventListener("click", (event) => {
			event.preventDefault();
			handleLogout();
		});
	});

	// My Bookings link for customers only
	if (role === "customer" || (!role && token)) {
		const desktop = document.getElementById("nav-mybookings");
		const mobile = document.getElementById("mobile-mybookings");
		if (desktop) desktop.style.display = "block";
		if (mobile) mobile.style.display = "block";
	}
}

function handleLogout() {
	localStorage.clear();
	window.location.href = "/pages/Login.html";
}

// AI assistant widget on every page except sign-in and registration
window.addEventListener("load", function () {
	if (/\/(login|register)\.html$/i.test(window.location.pathname)) return;
	const script = document.createElement("script");
	script.src = "/js/chat.js";
	document.body.appendChild(script);
});
