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

document.addEventListener("DOMContentLoaded", function () {
	// Managers only - everyone else goes to their own home page
	const token = localStorage.getItem("token");
	const role = localStorage.getItem("role");
	if (!token) {
		window.location.href = `/pages/Login.html?redirect=${encodeURIComponent(location.pathname)}`;
		return;
	}
	if (role !== "manager") {
		window.location.href = role === "staff" ? "/pages/staff.html" : "/pages/index.html";
		return;
	}

	document.getElementById("date-display").textContent = new Date().toLocaleDateString("en-NZ", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	// - Chart setup ---------------------------------
	// A progression of brown tones from the design system
	const browns = ["#4A3B32", "#6B5743", "#8B7355", "#B89F89", "#D4C4B0", "#9A826A", "#2C241B", "#E6DFD7"];
	Chart.defaults.font.family = "'Outfit', sans-serif";
	Chart.defaults.color = "#7a654b";

	const money = (n) => "$" + Math.round(n).toLocaleString("en-NZ");
	const shortDate = (ymd) => new Date(ymd + "T12:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" });

	// Each chart is drawn once; later refreshes swap in the new numbers and
	// animate the change instead of drawing a second chart on top
	const charts = {};
	function drawChart(canvasId, config) {
		const chart = charts[canvasId];
		if (!chart) {
			charts[canvasId] = new Chart(document.getElementById(canvasId), config);
			return;
		}
		chart.data.labels = config.data.labels;
		chart.data.datasets.forEach((dataset, i) => (dataset.data = config.data.datasets[i].data));
		chart.update();
	}

	const axes = (yFormat) => ({
		x: { grid: { display: false }, border: { display: false } },
		y: { grid: { color: "#E6DFD7" }, border: { display: false }, ticks: yFormat ? { callback: yFormat } : { precision: 0 } },
	});

	// The same figures as a table, for screen readers and exact numbers
	function table(id, headings, rows) {
		document.getElementById(id).innerHTML = `
			<table>
				<thead><tr>${headings.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
				<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody>
			</table>`;
	}

	async function get(url) {
		const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
		if (res.status === 401 || res.status === 403) {
			localStorage.clear();
			window.location.href = "/pages/Login.html";
			throw new Error("signed out");
		}
		return res.json();
	}

	// - Period (7 / 30 / 90 days) ---------------------
	let days = 30;
	try {
		days = Number(localStorage.getItem("managerDays")) || 30;
	} catch {}
	if (![7, 30, 90].includes(days)) days = 30;

	document.getElementById("range-switch").addEventListener("click", (e) => {
		const chip = e.target.closest("[data-days]");
		if (!chip) return;
		days = Number(chip.dataset.days);
		try {
			localStorage.setItem("managerDays", String(days));
		} catch {}
		loadPeriod();
	});

	// "▲ 12% vs previous 30 days"
	function delta(id, now, before, { suffix = "%", points = false, decimals = 0 } = {}) {
		const el = document.getElementById(id);
		if (now == null || before == null || (!points && !before)) {
			el.className = "delta";
			el.textContent = before == null ? "No earlier data" : "";
			return;
		}
		const change = points ? now - before : ((now - before) / before) * 100;
		const shown = Math.abs(change).toFixed(decimals);
		const dir = Number(shown) === 0 ? "" : change > 0 ? "up" : "down";
		el.className = `delta ${dir}`;
		el.innerHTML = `<span aria-hidden="true">${dir === "up" ? "▲" : dir === "down" ? "▼" : "■"}</span>
			<span>${dir ? (change > 0 ? "+" : "−") : ""}${shown}${suffix} <span style="color:var(--lux-text-muted)">vs previous ${days} days</span></span>`;
	}

	async function loadPeriod() {
		document.querySelectorAll("#range-switch [data-days]").forEach((c) => c.setAttribute("aria-pressed", String(Number(c.dataset.days) === days)));
		document.querySelectorAll("[data-range-label]").forEach((el) => (el.textContent = `Last ${days} days`));

		const p = await get(`/manager/period?days=${days}`);
		const { current: c, previous: prev } = p;
		document.getElementById("kpis").removeAttribute("aria-busy");
		document.getElementById("range-note").textContent =
			`${shortDate(c.from)} – ${shortDate(c.to)}, compared with ${shortDate(prev.from)} – ${shortDate(prev.to)}.`;

		document.getElementById("stat-revenue").textContent = money(c.revenue);
		delta("delta-revenue", c.revenue, prev.revenue);
		document.getElementById("stat-ahead").textContent = money(p.bookedAhead.revenue);
		document.getElementById("stat-ahead-note").textContent = `${p.bookedAhead.nights} nights in the next ${days} days`;
		document.getElementById("stat-occupancy").textContent = c.occupancyPct + "%";
		delta("delta-occupancy", c.occupancyPct, prev.occupancyPct, { suffix: " pts", points: true });
		document.getElementById("stat-rooms").textContent = `Right now: ${p.occupancyNow}%`;
		document.getElementById("stat-rate").textContent = money(c.avgNightlyRate);
		delta("delta-rate", c.avgNightlyRate, prev.avgNightlyRate);
		document.getElementById("stat-rating").textContent = c.avgRating == null ? "–" : c.avgRating.toFixed(1);
		delta("delta-rating", c.avgRating, prev.avgRating, { suffix: "", points: true, decimals: 1 });
		document.getElementById("stat-reviews").textContent = `${c.reviews} ${c.reviews === 1 ? "review" : "reviews"} this period`;

		// Revenue earned each night
		drawChart("chart-trend", {
			type: "bar",
			data: {
				labels: p.trend.map((t) => shortDate(t.date)),
				datasets: [{ data: p.trend.map((t) => t.revenue), backgroundColor: "#8B7355", borderWidth: 0, borderRadius: 2 }],
			},
			options: {
				plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => money(ctx.raw) } } },
				scales: axes((v) => money(v)),
			},
		});
		table("table-trend", ["Night", "Bookings made", "Revenue earned"], p.trend.map((t) => [shortDate(t.date), t.bookings, money(t.revenue)]));

		// Nights sold by room type
		drawChart("chart-mix", {
			type: "doughnut",
			data: {
				labels: p.mix.map((m) => m.type),
				datasets: [{ data: p.mix.map((m) => m.nights), backgroundColor: browns, borderWidth: 2, borderColor: "#fff" }],
			},
			options: { plugins: { legend: { display: false } }, cutout: "60%" },
		});
		const totalNights = p.mix.reduce((s, m) => s + m.nights, 0) || 1;
		document.getElementById("mix-legend").innerHTML = p.mix
			.map((m, i) => `
				<div class="flex items-center gap-1">
					<span style="width:10px;height:10px;background:${browns[i]};display:inline-block;"></span>
					<span style="font-size:12px;color:#7a654b;">${escapeHtml(m.type)} · ${Math.round((m.nights / totalNights) * 100)}%</span>
				</div>`)
			.join("");
		table("table-mix", ["Room type", "Nights sold"], p.mix.map((m) => [m.type, m.nights]));

		// Most-booked rooms
		drawChart("chart-top-rooms", {
			type: "bar",
			data: {
				labels: p.topRooms.map((r) => "Room " + r.roomId),
				datasets: [{ data: p.topRooms.map((r) => r.nights), backgroundColor: browns, borderWidth: 0 }],
			},
			options: {
				plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw} nights` } } },
				scales: axes(),
			},
		});
		table("table-top-rooms", ["Room", "Nights sold"], p.topRooms.map((r) => ["Room " + r.roomId, r.nights]));

		// Revenue by floor
		drawChart("chart-floor", {
			type: "bar",
			data: {
				labels: p.revenueByFloor.map((f) => f.floor.replace("F", "Floor ")),
				datasets: [{ data: p.revenueByFloor.map((f) => f.revenue), backgroundColor: "#8B7355", borderWidth: 0 }],
			},
			options: {
				plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => money(ctx.raw) } } },
				scales: axes((v) => money(v)),
			},
		});
		table("table-floor", ["Floor", "Revenue earned"], p.revenueByFloor.map((f) => [f.floor.replace("F", "Floor "), money(f.revenue)]));
	}

	// - CSV export ------------------------------------
	// Every booking with a night in the chosen period, ready for a spreadsheet
	document.getElementById("export-csv").addEventListener("click", async () => {
		try {
			const bookings = await get("/bookings");
			const to = new Date().toLocaleDateString("en-CA");
			const fromDate = new Date();
			fromDate.setDate(fromDate.getDate() - (days - 1));
			const from = fromDate.toLocaleDateString("en-CA");
			const rows = bookings
				.filter((b) => b.checkIn <= to && b.checkOut > from)
				.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
			const columns = ["id", "userName", "guestEmail", "roomId", "roomType", "floor", "checkIn", "checkOut", "nights", "total", "status", "createdAt"];
			const cell = (v) => {
				const text = String(v ?? "");
				return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
			};
			const csv = [columns.join(","), ...rows.map((b) => columns.map((c) => cell(b[c])).join(","))].join("\r\n");
			const link = document.createElement("a");
			link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
			link.download = `bookings-${from}-to-${to}.csv`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			UI.toast(`Exported ${rows.length} bookings`);
		} catch {
			UI.toast("Couldn't export the bookings. Please try again.", "error");
		}
	});

	// - Staff assignments ------------------------------
	async function loadStaff() {
		const staff = await get("/manager/staff");
		document.getElementById("staff-list").innerHTML = staff
			.map((s) => {
				const initials = s.name.split(" ").map((n) => n[0]).join("");
				const attending = s.attending.length
					? s.attending.map(escapeHtml).join("<br>")
					: `<span style="color:#766658;">None</span>`;
				return `
                    <div class="staff-row">
                        <div class="flex items-center gap-3">
                            <div class="staff-avatar">${escapeHtml(initials)}</div>
                            <div>
                                <p class="meta-value font-medium">${escapeHtml(s.name)}</p>
                                <p style="font-size:12px; color:#766658;">${escapeHtml(s.email)}</p>
                            </div>
                        </div>
                        <p class="meta-value">${escapeHtml(s.shift)}</p>
                        <p class="meta-value" style="font-size:12px;">${attending}</p>
                        <p class="font-serif text-2xl" style="color:#2C241B;">${s.completed}</p>
                        <p class="font-serif text-2xl" style="color:#2C241B;">${s.total}</p>
                    </div>`;
			})
			.join("");
	}

	// - Recent reviews ---------------------------------
	async function loadReviews() {
		const reviews = await get("/manager/reviews");
		document.getElementById("reviews-list").innerHTML = reviews
			.map((r) => {
				const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
				return `
                    <div class="review-card">
                        <p class="stars text-sm mb-2" aria-label="${r.rating} out of 5 stars">${stars}</p>
                        ${r.title ? `<p class="font-serif text-lg mb-2" style="color:#2C241B;">"${escapeHtml(r.title)}"</p>` : ""}
                        <p class="text-sm mb-3" style="color:#6B5743;">${escapeHtml(r.comment)}</p>
                        <p class="meta-label">${escapeHtml(r.guestName)} · Room ${escapeHtml(r.roomId)} · ${escapeHtml(r.date)}</p>
                    </div>`;
			})
			.join("");
	}

	// - Load everything --------------------------------
	async function refreshAll() {
		await Promise.allSettled([loadPeriod(), loadStaff(), loadReviews()]);
		setLiveStatus(true, "Updated " + new Date().toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" }));
	}

	// - Live updates ------------------------------------
	// Keeps a connection open to the server, which says "change" whenever a
	// booking, cancellation, check-in, check-out or review happens anywhere.
	// The page then refreshes its numbers - no reload needed.
	function setLiveStatus(live, text) {
		const el = document.getElementById("live-status");
		if (!el) return;
		el.classList.toggle("offline", !live);
		el.querySelector("[data-live-label]").textContent = live ? "Live" : text;
		el.querySelector("[data-live-text]").textContent = live ? text : "";
	}

	let refreshQueued = false;
	async function queueRefresh() {
		if (refreshQueued) return;
		refreshQueued = true;
		await refreshAll();
		refreshQueued = false;
	}

	async function listenForChanges(retryDelay = 2000) {
		try {
			const res = await fetch("/manager/live", { headers: { Authorization: "Bearer " + token } });
			if (!res.ok) throw new Error("not allowed");
			const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = "";
			retryDelay = 2000;
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += value;
				const messages = buffer.replace(/\r/g, "").split("\n\n");
				buffer = messages.pop();
				if (messages.some((m) => m.startsWith("event: change"))) queueRefresh();
			}
		} catch {
			/* reconnect below */
		}
		// Connection dropped (e.g. the server restarted): try again, a little
		// slower each time, and catch up on anything missed
		setLiveStatus(false, "Reconnecting…");
		setTimeout(async () => {
			await refreshAll();
			listenForChanges(Math.min(retryDelay * 2, 30000));
		}, retryDelay);
	}

	refreshAll();
	listenForChanges();
});
