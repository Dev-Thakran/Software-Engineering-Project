document.addEventListener("DOMContentLoaded", function () {
	const token = localStorage.getItem("token");
	if (!token) {
		window.location.href = "/pages/Login.html";
		return;
	}

	// Date display
	const now = new Date();
	const dateOptions = {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	};
	document.getElementById("date-display").textContent = now.toLocaleDateString(
		"en-NZ",
		dateOptions,
	);

	// Chart colour palette
	const browns = [
		"#4A3B32",
		"#6B5743",
		"#8B7355",
		"#B89F89",
		"#D4C4B0",
		"#9A826A",
		"#2C241B",
		"#E6DFD7",
	];

	const chartDefaults = {
		font: { family: "'Outfit', sans-serif", size: 11 },
		color: "#8B7355",
	};
	Chart.defaults.font.family = "'Outfit', sans-serif";
	Chart.defaults.color = "#8B7355";

	async function get(url) {
		const res = await fetch(url, {
			headers: { Authorization: "Bearer " + token },
		});
		return res.json();
	}

	// Load KPI stats
	async function loadStats() {
		const d = await get("/manager/stats");
		document.getElementById("stat-revenue").textContent =
			"$" + d.totalRevenue.toLocaleString();
		document.getElementById("stat-occupancy").textContent =
			d.occupancyPct + "%";
		document.getElementById("stat-rooms").textContent =
			"Of " + d.totalRooms + " rooms";
		document.getElementById("stat-rating").textContent = d.avgRating;
		document.getElementById("stat-reviews").textContent =
			d.totalReviews + " reviews";
		document.getElementById("stat-bookings").textContent = d.totalBookings;
	}

	// Top rooms chart
	async function loadTopRooms() {
		const data = await get("/manager/top-rooms");
		new Chart(document.getElementById("chart-top-rooms"), {
			type: "bar",
			data: {
				labels: data.map((r) => "Room " + r.roomId),
				datasets: [
					{
						data: data.map((r) => r.count),
						backgroundColor: browns,
						borderWidth: 0,
					},
				],
			},
			options: {
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: { label: (ctx) => `bookings : ${ctx.raw}` },
					},
				},
				scales: {
					x: { grid: { display: false }, border: { display: false } },
					y: {
						grid: { color: "#E6DFD7" },
						border: { display: false },
						ticks: { stepSize: 1 },
					},
				},
			},
		});
	}

	// Booking mix donut
	async function loadMix() {
		const data = await get("/manager/booking-mix");
		new Chart(document.getElementById("chart-mix"), {
			type: "doughnut",
			data: {
				labels: data.map((d) => d.type),
				datasets: [
					{
						data: data.map((d) => d.count),
						backgroundColor: browns,
						borderWidth: 2,
						borderColor: "#fff",
					},
				],
			},
			options: {
				plugins: { legend: { display: false } },
				cutout: "60%",
			},
		});
		// Custom legend
		const legend = document.getElementById("mix-legend");
		data.forEach((d, i) => {
			legend.innerHTML += `
                    <div class="flex items-center gap-1">
                        <span style="width:10px;height:10px;background:${browns[i]};display:inline-block;"></span>
                        <span style="font-size:11px;color:#8B7355;">${d.type}</span>
                    </div>`;
		});
	}

	// Booking trend line chart
	async function loadTrend() {
		const data = await get("/manager/trend");
		new Chart(document.getElementById("chart-trend"), {
			type: "line",
			data: {
				labels: data.map((d) => d.date),
				datasets: [
					{
						data: data.map((d) => d.count),
						borderColor: "#4A3B32",
						backgroundColor: "transparent",
						pointBackgroundColor: "#4A3B32",
						pointRadius: 3,
						tension: 0.3,
						borderWidth: 1.5,
					},
				],
			},
			options: {
				plugins: { legend: { display: false } },
				scales: {
					x: { grid: { display: false }, border: { display: false } },
					y: {
						grid: { color: "#E6DFD7" },
						border: { display: false },
						ticks: { stepSize: 1 },
					},
				},
			},
		});
	}

	// Revenue by floor bar chart
	async function loadFloorRevenue() {
		const data = await get("/manager/revenue-by-floor");
		new Chart(document.getElementById("chart-floor"), {
			type: "bar",
			data: {
				labels: data.map((d) => d.floor),
				datasets: [
					{
						data: data.map((d) => d.revenue),
						backgroundColor: "#8B7355",
						borderWidth: 0,
					},
				],
			},
			options: {
				plugins: { legend: { display: false } },
				scales: {
					x: { grid: { display: false }, border: { display: false } },
					y: {
						grid: { color: "#E6DFD7" },
						border: { display: false },
						ticks: { callback: (v) => "$" + v.toLocaleString() },
					},
				},
			},
		});
	}

	// Staff assignments
	async function loadStaff() {
		const staff = await get("/manager/staff");
		const list = document.getElementById("staff-list");

		list.innerHTML = staff
			.map((s) => {
				const initials = s.name
					.split(" ")
					.map((n) => n[0])
					.join("");
				const attending = s.attending.length
					? s.attending.join("<br>")
					: `<span style="color:#B89F89;">None</span>`;
				return `
                    <div class="staff-row">
                        <div class="flex items-center gap-3">
                            <div class="staff-avatar">${initials}</div>
                            <div>
                                <p class="meta-value font-medium">${s.name}</p>
                                <p style="font-size:11px; color:#B89F89;">${s.email}</p>
                            </div>
                        </div>
                        <p class="meta-value">${s.shift}</p>
                        <p class="meta-value" style="font-size:12px;">${attending}</p>
                        <p class="font-serif text-2xl" style="color:#2C241B;">${s.completed}</p>
                        <p class="font-serif text-2xl" style="color:#2C241B;">${s.total}</p>
                    </div>`;
			})
			.join("");
	}

	// Recent reviews
	async function loadReviews() {
		const reviews = await get("/manager/reviews");
		const list = document.getElementById("reviews-list");

		list.innerHTML = reviews
			.map((r) => {
				const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
				return `
                    <div class="review-card">
                        <p class="stars text-sm mb-2">${stars}</p>
                        <p class="font-serif text-lg mb-2" style="color:#2C241B;">"${r.title}"</p>
                        <p class="text-sm mb-3" style="color:#6B5743;">${r.comment}</p>
                        <p class="meta-label">${r.guestName} · Room ${r.roomId}</p>
                    </div>`;
			})
			.join("");
	}

	// Load everything
	loadStats();
	loadTopRooms();
	loadMix();
	loadTrend();
	loadFloorRevenue();
	loadStaff();
	loadReviews();
});
