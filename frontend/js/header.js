window.addEventListener("load", function () {
	var header = document.getElementById("header");
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("GET", "/pages/header.html", false);
	xmlhttp.send();
	header.innerHTML = xmlhttp.responseText;

	// Active nav link highlighting
	const navLinkEls = document.querySelectorAll(
		".navbar-nav .nav-link:not(.btn)",
	);
	const windowPathname = window.location.pathname;

	navLinkEls.forEach((navLinkEl) => {
		const navLinkPathname = new URL(navLinkEl.href).pathname;
		if (navLinkEl.classList.contains("dropdown-toggle")) return;
		if (
			windowPathname === navLinkPathname ||
			(windowPathname === "/index.html" && navLinkPathname === "/")
		) {
			navLinkEl.classList.add("active");
		}
	});

	// Update auth section based on login state
	const token = localStorage.getItem("token");
	const role = localStorage.getItem("role");
	const name = localStorage.getItem("name");
	const authEl = document.getElementById("nav-auth");

	if (!authEl) return;

	if (token && name) {
		const firstName = name.split(" ")[0];

		if (role === "staff") {
			// Staff: name + dashboard link + sign out, no reserve
			authEl.innerHTML = `
            <a href="/pages/staff.html" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;text-decoration:none;">
                ${firstName} - Dashboard
            </a>
            <button onclick="handleLogout()" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;background:none;border:none;cursor:pointer;padding:0;">
                Sign Out
            </button>`;
		} else if (role === "manager") {
			// Manager: name + dashboard link + sign out, no reserve
			authEl.innerHTML = `
            <a href="/pages/manager.html" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;text-decoration:none;">
                ${firstName} - Dashboard
            </a>
            <button onclick="handleLogout()" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;background:none;border:none;cursor:pointer;padding:0;">
                Sign Out
            </button>`;
		} else {
			// Customer: first name + sign out + keep reserve button
			authEl.innerHTML = `
            <span style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;">
                ${firstName}
            </span>
            <button onclick="handleLogout()" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;background:none;border:none;cursor:pointer;padding:0;">
                Sign Out
            </button>
            <a href="/pages/rooms.html" class="btn-reserve">Reserve</a>`;
		}
	} else {
		// Not logged in: sign in + reserve
		authEl.innerHTML = `
        <a href="/pages/Login.html" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;text-decoration:none;">
            Sign In
        </a>
        <a href="/pages/rooms.html" class="btn-reserve">Reserve</a>`;
	}
});

function handleLogout() {
	localStorage.clear();
	window.location.href = "/pages/Login.html";
}
