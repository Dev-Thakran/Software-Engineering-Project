window.addEventListener("load", function () {
    var header = document.getElementById("header");
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", "/pages/header.html", false);
    xmlhttp.send();
    header.innerHTML = xmlhttp.responseText;

    // ── Active nav link highlighting ───────────────────────────
    const navLinkEls     = document.querySelectorAll(".navbar-nav .nav-link:not(.btn)");
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

    // ── Hamburger toggle ───────────────────────────────────────
    const hamburger  = document.getElementById("hamburger");
    const mobileMenu = document.getElementById("mobile-menu");

    if (hamburger && mobileMenu) {
        hamburger.addEventListener("click", function () {
            hamburger.classList.toggle("open");
            mobileMenu.classList.toggle("open");
        });

        mobileMenu.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                hamburger.classList.remove("open");
                mobileMenu.classList.remove("open");
            });
        });
    }

    // ── Auth section ───────────────────────────────────────────
    const token  = localStorage.getItem("token");
    const role   = localStorage.getItem("role");
    const name   = localStorage.getItem("name");
    const authEl = document.getElementById("nav-auth");

    if (!authEl) return;

    // Desktop auth — exactly the same as original, no style changes
    if (token && name) {
        const firstName = name.split(" ")[0];

        if (role === "staff") {
            authEl.innerHTML = `
                <a href="/pages/staff.html" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;text-decoration:none;">
                    ${firstName} — Dashboard
                </a>`;
        } else if (role === "manager") {
            authEl.innerHTML = `
                <a href="/pages/manager.html" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;text-decoration:none;">
                    ${firstName} — Dashboard
                </a>`;
        } else {
            authEl.innerHTML = `
                <span style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;">
                    ${firstName}
                </span>
                <a href="/pages/rooms.html" class="btn-reserve">Reserve</a>`;
        }
    } else {
        authEl.innerHTML = `
            <a href="/pages/Login.html" class="nav-signin" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#555;text-decoration:none;">
                Sign In
            </a>
            <a href="/pages/rooms.html" class="btn-reserve">Reserve</a>`;
    }

    // ── Mobile auth — sign in/out always in hamburger ──────────
    const mobileAuth = document.getElementById("mobile-auth");
    if (mobileAuth) {
        if (token && name) {
            // Always show sign out in hamburger when logged in
            mobileAuth.innerHTML = `
                <a href="#" onclick="handleLogout(); return false;">Sign Out</a>`;
        } else {
            // Show sign in in hamburger when not logged in
            mobileAuth.innerHTML = `
                <a href="/pages/Login.html">Sign In</a>`;
        }
    }
});

function handleLogout() {
    localStorage.clear();
    window.location.href = "/pages/Login.html";
}