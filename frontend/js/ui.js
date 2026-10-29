// ============================================================
//  ui.js - Small shared interface helpers, available as window.UI
//    UI.toast(message, "success" | "error")   short message at the bottom
//    UI.confirm({ title, message, confirmLabel, danger }) -> Promise<boolean>
//    UI.dialog({ title, body, confirmLabel, onConfirm }) -> Promise<result>
//    UI.skeleton(count, html)    loading placeholders
//    UI.icon(name)               one consistent set of line icons
//    UI.escape(text)             safe text for innerHTML
//  Elements with a data-reveal attribute fade in as they scroll into view.
// ============================================================

(function () {
	if (window.UI) return;

	function escape(value) {
		return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		})[ch]);
	}

	// ---------- Icons (24x24 line icons, drawn with currentColor) ----------
	const PATHS = {
		bed: '<path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v1"/><circle cx="7" cy="10" r="2"/>',
		guests: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
		area: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h5V4M15 20v-5h5"/>',
		star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
		check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
		calendar: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>',
		clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
		users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
		list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
		chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
		building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3"/>',
		search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
		close: '<path d="M6 6l12 12M18 6 6 18"/>',
		arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
		pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
		phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
		mail: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/>',
		eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
		eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
		door: '<path d="M4 21h16M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><circle cx="14.5" cy="12" r=".8"/>',
		download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
		access: '<circle cx="12" cy="4.5" r="1.8"/><path d="M12 7.5v6h5l2.5 5.5"/><path d="M12 10.5H8"/><path d="M8.5 13.2a5.5 5.5 0 1 0 7.3 6.5"/>',
	};
	function icon(name, label) {
		const a11y = label ? `role="img" aria-label="${escape(label)}"` : 'aria-hidden="true"';
		return `<svg class="icon" viewBox="0 0 24 24" ${a11y}>${PATHS[name] || ""}</svg>`;
	}

	// ---------- Toasts ----------
	function toast(message, type = "success", ms = 3800) {
		let stack = document.querySelector(".toast-stack");
		if (!stack) {
			stack = document.createElement("div");
			stack.className = "toast-stack";
			stack.setAttribute("role", "status");
			stack.setAttribute("aria-live", "polite");
			document.body.appendChild(stack);
		}
		const el = document.createElement("div");
		el.className = `toast ${type}`;
		el.textContent = message;
		stack.appendChild(el);
		setTimeout(() => {
			el.classList.add("leaving");
			setTimeout(() => el.remove(), 260);
		}, ms);
	}

	// ---------- Dialogs ----------
	// `body` is HTML (escape anything user-provided). `onConfirm(card)` may
	// return a value (passed back) or throw an Error whose message is shown.
	// `onOpen(card)` runs once the dialog is on screen (e.g. to wire up inputs).
	// While onConfirm is saving, the dialog can't be dismissed, so the page
	// always learns the result.
	function dialog({ title, body = "", confirmLabel = "OK", cancelLabel = "Cancel", danger = false, onConfirm, onOpen }) {
		return new Promise((resolve) => {
			const previousFocus = document.activeElement;
			const overlay = document.createElement("div");
			overlay.className = "ui-dialog";
			overlay.innerHTML = `
				<div class="ui-dialog-card" role="dialog" aria-modal="true" aria-labelledby="ui-dialog-title">
					<h2 id="ui-dialog-title" class="font-serif">${escape(title)}</h2>
					<div class="ui-dialog-body">${body}</div>
					<p class="field-error ui-dialog-error" role="alert" hidden></p>
					<div class="ui-dialog-actions">
						${cancelLabel ? `<button type="button" class="btn-secondary" data-cancel>${escape(cancelLabel)}</button>` : ""}
						<button type="button" class="btn-primary${danger ? " danger" : ""}" data-confirm>${escape(confirmLabel)}</button>
					</div>
				</div>`;
			const card = overlay.querySelector(".ui-dialog-card");
			const errorEl = overlay.querySelector(".ui-dialog-error");
			const confirmBtn = overlay.querySelector("[data-confirm]");

			let saving = false;
			const close = (result) => {
				if (saving && result === null) return; // wait for the save to finish
				document.removeEventListener("keydown", onKey);
				overlay.classList.add("closing");
				setTimeout(() => overlay.remove(), 180);
				previousFocus?.focus?.();
				resolve(result);
			};
			const onKey = (e) => {
				if (e.key === "Escape") close(null);
				// Keep keyboard focus inside the dialog
				if (e.key === "Tab") {
					const items = [...card.querySelectorAll("button, input, textarea, select, [tabindex]")].filter((x) => !x.disabled);
					const first = items[0], last = items[items.length - 1];
					if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
					else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
				}
			};
			overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
			overlay.querySelector("[data-cancel]")?.addEventListener("click", () => close(null));
			confirmBtn.addEventListener("click", async () => {
				errorEl.hidden = true;
				if (!onConfirm) return close(true);
				confirmBtn.disabled = true;
				saving = true;
				try {
					const result = await onConfirm(card);
					saving = false;
					close(result === undefined ? true : result);
				} catch (err) {
					saving = false;
					errorEl.textContent = err.message;
					errorEl.hidden = false;
					confirmBtn.disabled = false;
				}
			});
			document.addEventListener("keydown", onKey);
			document.body.appendChild(overlay);
			onOpen?.(card);
			(card.querySelector("input, textarea, select") || confirmBtn).focus();
		});
	}

	function confirm({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false }) {
		return dialog({ title, body: `<p>${escape(message)}</p>`, confirmLabel, cancelLabel, danger }).then(Boolean);
	}

	// ---------- Dates (YYYY-MM-DD strings in the visitor's own timezone) ----------
	const dates = {
		today: () => new Date().toLocaleDateString("en-CA"),
		addDays(ymd, days) {
			const d = new Date(ymd + "T12:00:00");
			d.setDate(d.getDate() + days);
			return d.toLocaleDateString("en-CA");
		},
		nights: (from, to) => Math.round((new Date(to + "T12:00:00") - new Date(from + "T12:00:00")) / 86400000),
		// "Fri 14 Nov" (or with the year when asked)
		pretty(ymd, withYear = false) {
			return new Date(ymd + "T12:00:00").toLocaleDateString("en-NZ", {
				weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}),
			});
		},
		valid: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "") && !isNaN(new Date(v)),
	};
	const money = (n) => "$" + Number(n).toLocaleString("en-NZ");

	// ---------- Loading placeholders ----------
	function skeleton(count, html) {
		return Array.from({ length: count }, () => html).join("");
	}

	// ---------- Fade-in on scroll ----------
	function watchReveals(root = document) {
		const items = root.querySelectorAll("[data-reveal]:not(.revealed)");
		if (!("IntersectionObserver" in window)) return items.forEach((el) => el.classList.add("revealed"));
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				const delay = Number(entry.target.dataset.revealDelay || 0);
				setTimeout(() => entry.target.classList.add("revealed"), delay);
				observer.unobserve(entry.target);
			});
		}, { rootMargin: "0px 0px -8% 0px" });
		items.forEach((el) => observer.observe(el));
	}
	// <span data-icon="clock"></span> in page markup becomes that icon
	function fillIcons(root = document) {
		root.querySelectorAll("[data-icon]:empty").forEach((el) => {
			el.innerHTML = icon(el.dataset.icon);
		});
	}
	document.addEventListener("DOMContentLoaded", () => {
		fillIcons();
		watchReveals();
	});

	// Adds a show/hide button to every password input inside .password-wrap
	function passwordToggles(root = document) {
		root.querySelectorAll(".password-wrap input").forEach((input) => {
			if (input.dataset.toggle) return;
			input.dataset.toggle = "1";
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "password-toggle";
			const sync = () => {
				const shown = input.type === "text";
				btn.innerHTML = icon(shown ? "eyeOff" : "eye");
				btn.setAttribute("aria-label", shown ? "Hide password" : "Show password");
				btn.setAttribute("aria-pressed", String(shown));
			};
			btn.addEventListener("click", () => {
				input.type = input.type === "password" ? "text" : "password";
				sync();
				input.focus();
			});
			sync();
			input.after(btn);
		});
	}
	document.addEventListener("DOMContentLoaded", () => passwordToggles());

	// Only same-site page paths are allowed as a place to return to after sign-in
	function safeRedirect(value) {
		return typeof value === "string" && /^\/pages\/[\w./?=&%-]*$/.test(value) && !value.includes("//") ? value : null;
	}

	// Saves a stay as an .ics file so it lands in the guest's own calendar
	function downloadStay(booking) {
		const compact = (ymd, time) => ymd.replace(/-/g, "") + "T" + time + "00";
		const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
		const ics = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//La Extravaganza//Booking//EN",
			"BEGIN:VEVENT",
			"UID:" + booking.id + "@laextravaganza",
			"DTSTAMP:" + stamp,
			"DTSTART;TZID=Pacific/Auckland:" + compact(booking.checkIn, "1500"),
			"DTEND;TZID=Pacific/Auckland:" + compact(booking.checkOut, "1100"),
			"SUMMARY:Stay at La Extravaganza - Room " + booking.roomId,
			"LOCATION:La Extravaganza\\, 42 Harbour Avenue\\, Auckland Central 1010\\, New Zealand",
			"DESCRIPTION:Booking reference " + booking.id + ". Check-in from 3pm\\, check-out by 11am. Reception +64 9 123 4567.",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");
		const link = document.createElement("a");
		link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
		link.download = "la-extravaganza-" + booking.id + ".ics";
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
	}

	// ---------- Party size: adults + children (children count toward capacity) ----------
	const party = {
		// From the address bar: ?adults=2&children=1 (old ?guests=2 links read as adults)
		fromParams(params, defaults = { adults: 2, children: 0 }) {
			const n = (v) => (v !== null && /^\d+$/.test(v) ? Number(v) : null);
			const adults = n(params.get("adults")) ?? n(params.get("guests")) ?? defaults.adults;
			const children = n(params.get("children")) ?? defaults.children;
			return { adults: Math.min(Math.max(adults, 0), 4), children: Math.min(Math.max(children, 0), 3) };
		},
		total: (p) => p.adults + p.children,
		// "2 adults, 1 child"
		label(p) {
			const a = `${p.adults} ${p.adults === 1 ? "adult" : "adults"}`;
			return p.children ? `${a}, ${p.children} ${p.children === 1 ? "child" : "children"}` : a;
		},
		// Writes adults/children into URLSearchParams (skipping the defaults)
		toParams(params, p) {
			params.delete("guests");
			if (p.adults) params.set("adults", p.adults);
			if (p.children) params.set("children", p.children);
			else params.delete("children");
			return params;
		},
		// Fills a pair of <select>s with the allowed ranges
		fillSelects(adultsEl, childrenEl, p, { maxTotal = 4, anyAdults = false } = {}) {
			adultsEl.innerHTML = (anyAdults ? ['<option value="0">Any</option>'] : [])
				.concat([1, 2, 3, 4].filter((n) => n <= maxTotal).map((n) => `<option value="${n}">${n}</option>`)).join("");
			childrenEl.innerHTML = [0, 1, 2, 3].filter((n) => n < maxTotal).map((n) => `<option value="${n}">${n}</option>`).join("");
			adultsEl.value = String(Math.min(p.adults, maxTotal));
			if (adultsEl.selectedIndex < 0) adultsEl.selectedIndex = anyAdults ? 0 : Math.min(1, adultsEl.options.length - 1);
			childrenEl.value = String(Math.min(p.children, Math.max(maxTotal - 1, 0)));
			if (childrenEl.selectedIndex < 0) childrenEl.selectedIndex = 0;
		},
	};

	window.UI = { toast, dialog, confirm, skeleton, icon, escape, watchReveals, fillIcons, dates, money, passwordToggles, safeRedirect, downloadStay, party };
})();
