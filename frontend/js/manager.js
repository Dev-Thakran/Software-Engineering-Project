document.addEventListener("DOMContentLoaded", function () {
	// Wait for the full HTML to load before running any JavaScript
	// This prevents errors from trying to access elements that don't exist yet

	const token = localStorage.getItem("token");
	// Retrieve the JWT token stored when the user logged in
	// Every request to a protected backend route needs this token

	if (!token) {
		// If there is no token, the user is not logged in
		// Redirect them to the login page immediately
		window.location.href = "/pages/Login.html";
		return;
	}

	// - Date display ---------------------
	const now = new Date();
	// Create a Date object representing the current moment

	const dateOptions = {
		weekday: "long", // e.g. "Friday"
		day: "numeric", // e.g. "15"
		month: "long", // e.g. "May"
		year: "numeric", // e.g. "2026"
	};

	document.getElementById("date-display").textContent = now.toLocaleDateString(
		"en-NZ", // New Zealand locale for correct date formatting
		dateOptions,
	);

	// - Chart colour palette ------------------
	const browns = [
		// A progression of brown tones from the design system
		// Used across all charts to keep a consistent visual style
		"#4A3B32", // darkest - lux-brown-700
		"#6B5743", // lux-brown-600
		"#8B7355", // lux-brown-500
		"#B89F89", // lux-brown-300
		"#D4C4B0", // lux-brown-200
		"#9A826A", // lux-brown-400
		"#2C241B", // lux-brown-800
		"#E6DFD7", // lightest - lux-brown-100
	];

	// Set Chart.js global defaults so every chart uses Outfit font
	// and the muted brown colour for labels and ticks
	Chart.defaults.font.family = "'Outfit', sans-serif";
	Chart.defaults.color = "#8B7355";

	// - Helper function --------------------
	async function get(url) {
		// Reusable fetch helper that automatically attaches the JWT token
		// Every manager route is protected so this saves repeating headers
		const res = await fetch(url, {
			headers: { Authorization: "Bearer " + token },
		});
		return res.json();
		// Parse and return the JSON response body
	}

	// - KPI Stats -----------------------
	async function loadStats() {
		// Fetch the four headline numbers from the backend
		// The backend calculates these from bookings.json, rooms.json, reviews.json
		const d = await get("/manager/stats");

		// Display total revenue formatted with commas e.g. $2,277
		document.getElementById("stat-revenue").textContent =
			"$" + d.totalRevenue.toLocaleString();

		// Display occupancy as a percentage e.g. 25%
		document.getElementById("stat-occupancy").textContent =
			d.occupancyPct + "%";

		// Show total room count below the percentage
		document.getElementById("stat-rooms").textContent =
			"Of " + d.totalRooms + " rooms";

		// Average guest rating across all reviews
		document.getElementById("stat-rating").textContent = d.avgRating;

		// Total number of reviews submitted
		document.getElementById("stat-reviews").textContent =
			d.totalReviews + " reviews";

		// Total number of bookings ever made
		document.getElementById("stat-bookings").textContent = d.totalBookings;
	}

	// - Top rooms bar chart ------------------
	async function loadTopRooms() {
		// Fetch the most booked rooms - backend counts bookings per roomId
		const data = await get("/manager/top-rooms");

		new Chart(document.getElementById("chart-top-rooms"), {
			type: "bar",
			data: {
				// X axis labels - e.g. "Room 103", "Room 202"
				labels: data.map((r) => "Room " + r.roomId),
				datasets: [
					{
						// Y axis values - number of bookings per room
						data: data.map((r) => r.count),
						// Each bar gets a different brown shade from the palette
						backgroundColor: browns,
						borderWidth: 0,
					},
				],
			},
			options: {
				plugins: {
					legend: { display: false }, // Hide default legend - not needed for bar chart
					tooltip: {
						callbacks: {
							// Custom tooltip label showing "bookings : 3" instead of just "3"
							label: (ctx) => `bookings : ${ctx.raw}`,
						},
					},
				},
				scales: {
					x: {
						grid: { display: false }, // No vertical grid lines
						border: { display: false }, // No axis border line
					},
					y: {
						grid: { color: "#E6DFD7" }, // Subtle horizontal grid lines
						border: { display: false },
						ticks: { stepSize: 1 }, // Only show whole numbers on Y axis
					},
				},
			},
		});
	}

	// - Booking mix doughnut chart ---------------
	async function loadMix() {
		// Fetch booking counts grouped by room type
		// e.g. Standard Single: 2, Deluxe Double: 3
		const data = await get("/manager/booking-mix");

		new Chart(document.getElementById("chart-mix"), {
			type: "doughnut",
			data: {
				labels: data.map((d) => d.type), // Room type names
				datasets: [
					{
						data: data.map((d) => d.count), // Booking counts per type
						backgroundColor: browns,
						borderWidth: 2,
						borderColor: "#fff", // White gap between segments
					},
				],
			},
			options: {
				plugins: { legend: { display: false } }, // We build a custom legend below
				cutout: "60%", // Makes it a doughnut instead of a full pie
			},
		});

		// Build a custom legend manually because Chart.js legend doesn't match the design
		const legend = document.getElementById("mix-legend");
		data.forEach((d, i) => {
			// For each room type, create a coloured square and label
			legend.innerHTML += `
                <div class="flex items-center gap-1">
                    <span style="width:10px;height:10px;background:${browns[i]};display:inline-block;"></span>
                    <span style="font-size:11px;color:#8B7355;">${d.type}</span>
                </div>`;
		});
	}

	// - Booking trend line chart ----------------
	async function loadTrend() {
		// Fetch daily booking counts for the last 14 days
		// Backend loops through dates and counts bookings created on each day
		const data = await get("/manager/trend");

		new Chart(document.getElementById("chart-trend"), {
			type: "line",
			data: {
				labels: data.map((d) => d.date), // Dates on X axis e.g. "05-04"
				datasets: [
					{
						data: data.map((d) => d.count), // Booking count on Y axis
						borderColor: "#4A3B32", // Dark brown line
						backgroundColor: "transparent", // No fill under the line
						pointBackgroundColor: "#4A3B32", // Dot colour at each data point
						pointRadius: 3, // Small dots
						tension: 0.3, // Slight curve on the line
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
						ticks: { stepSize: 1 }, // Only whole numbers
					},
				},
			},
		});
	}

	// - Revenue by floor bar chart ---------------
	async function loadFloorRevenue() {
		// Fetch total revenue grouped by hotel floor
		// Backend sums booking totals per floor number
		const data = await get("/manager/revenue-by-floor");

		new Chart(document.getElementById("chart-floor"), {
			type: "bar",
			data: {
				labels: data.map((d) => d.floor), // Floor labels e.g. "F1", "F2"
				datasets: [
					{
						data: data.map((d) => d.revenue), // Revenue amount per floor
						backgroundColor: "#8B7355", // Single consistent colour
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
						ticks: {
							// Format Y axis numbers as currency e.g. "$1,200"
							callback: (v) => "$" + v.toLocaleString(),
						},
					},
				},
			},
		});
	}

	// - Staff assignments table ----------------
	async function loadStaff() {
		// Fetch all staff members with their shift, attendance, and check-in stats
		// Backend joins users.json, shifts.json, and checkins.json together
		const staff = await get("/manager/staff");
		const list = document.getElementById("staff-list");

		list.innerHTML = staff
			.map((s) => {
				// Generate initials from staff name for the avatar circle
				// e.g. "Mike Tane" → "MT"
				const initials = s.name
					.split(" ")
					.map((n) => n[0])
					.join("");

				// Show attending guests or "None" if not attending anyone
				const attending = s.attending.length
					? s.attending.join("<br>") // Multiple guests separated by line break
					: `<span style="color:#B89F89;">None</span>`;

				// Return the HTML for one staff row in the table
				return `
                    <div class="staff-row">
                        <div class="flex items-center gap-3">
                            <!-- Avatar circle with initials -->
                            <div class="staff-avatar">${initials}</div>
                            <div>
                                <p class="meta-value font-medium">${s.name}</p>
                                <p style="font-size:11px; color:#B89F89;">${s.email}</p>
                            </div>
                        </div>
                        <!-- Shift type and hours -->
                        <p class="meta-value">${s.shift}</p>
                        <!-- Guests currently being attended by this staff member -->
                        <p class="meta-value" style="font-size:12px;">${attending}</p>
                        <!-- Number of check-ins completed this shift -->
                        <p class="font-serif text-2xl" style="color:#2C241B;">${s.completed}</p>
                        <!-- Total check-ins handled all time -->
                        <p class="font-serif text-2xl" style="color:#2C241B;">${s.total}</p>
                    </div>`;
			})
			.join(""); // Join all rows into one HTML string
	}

	// - Recent reviews ---------------------
	async function loadReviews() {
		// Fetch the 6 most recent guest reviews
		// Backend returns reviews in reverse order so newest appears first
		const reviews = await get("/manager/reviews");
		const list = document.getElementById("reviews-list");

		list.innerHTML = reviews
			.map((r) => {
				// Build star rating display using Unicode star characters
				// e.g. rating 4 → "★★★★☆"
				const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);

				return `
                    <div class="review-card">
                        <!-- Gold star rating -->
                        <p class="stars text-sm mb-2">${stars}</p>
                        <!-- Review title in quotes -->
                        <p class="font-serif text-lg mb-2" style="color:#2C241B;">"${r.title}"</p>
                        <!-- Review body text -->
                        <p class="text-sm mb-3" style="color:#6B5743;">${r.comment}</p>
                        <!-- Guest name and room number -->
                        <p class="meta-label">${r.guestName} · Room ${r.roomId}</p>
                    </div>`;
			})
			.join("");
	}

	// - Load everything on page open --------------
	// All functions are called simultaneously using individual async calls
	// They don't depend on each other so they can all run at the same time
	loadStats();
	loadTopRooms();
	loadMix();
	loadTrend();
	loadFloorRevenue();
	loadStaff();
	loadReviews();
});
