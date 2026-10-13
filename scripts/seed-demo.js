// ============================================================
//  npm run seed:demo - fills the hotel with realistic demo data
//
//  About 3 months of past stays and 1 month of upcoming bookings,
//  with matching check-ins, reviews and staff rotas, so the manager
//  dashboard has real numbers to calculate. Existing accounts are
//  kept; made-up guests (@example.com) are added. The current data
//  files are backed up first (to DATA_BACKUP_DIR in .env, or the temp
//  folder). Running it again on the same day gives
//  the same data.
// ============================================================

const fs = require("fs");
const os = require("os");
const path = require("path");
const bcrypt = require("bcryptjs");
const { hotelNow, hotelTimeToMs, addDays } = require("../backend/config/hotel-time");

const DAYS_BACK = 90;
const DAYS_AHEAD = 30;
const SEED = 2026;

const GUEST_NAMES = [
	"Aroha Tipene", "Liam Walker", "Sophie Turner", "Hemi Parata", "Olivia Chen", "James Wilson",
	"Mere Kingi", "Noah Patel", "Isla Morrison", "Tama Rangi", "Charlotte Brown", "Lucas Martin",
	"Amelia Scott", "Wiremu Tane", "Ella Thompson", "Jack Robinson", "Grace Kim", "Mason Lee",
	"Ruby Clarke", "Ethan Singh", "Hana Ngata", "Oliver Smith", "Zoe Campbell", "Ari Te Huia",
	"Mia Johnson", "Leo Nguyen", "Emily Davies", "Kauri Hohaia", "Chloe Anderson", "Daniel Fraser",
	"Anika Sharma", "Ben Harris", "Lily Evans", "Rawiri Paki", "Hannah Murphy", "Sam O'Brien",
	"Yuki Tanaka", "Freya Jensen", "Mateo Garcia", "Priya Nair",
];

const DEMO_STAFF = [
	{ id: "u004", name: "Aroha Ngata", email: "aroha.ngata@example.com" },
	{ id: "u005", name: "Liam Chen", email: "liam.chen@example.com" },
];

// Who works when. Check-ins in the generated history are handled by
// whoever was on shift at the time.
const ROTA = [
	{ id: "sh001", staffId: "u002", staffName: "Mike Tane", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], shiftStart: "07:00", shiftEnd: "15:00", shiftType: "Morning" },
	{ id: "sh002", staffId: "u004", staffName: "Aroha Ngata", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], shiftStart: "15:00", shiftEnd: "23:00", shiftType: "Afternoon" },
	{ id: "sh003", staffId: "u005", staffName: "Liam Chen", days: ["Saturday", "Sunday"], shiftStart: "08:00", shiftEnd: "20:00", shiftType: "Weekend" },
];

// Chance that a free room gets a new stay starting on a given day, per
// floor (works out at roughly 60-75% occupancy, busier at weekends)
const FLOOR_DEMAND = { 1: 0.28, 2: 0.34, 3: 0.37, 4: 0.27 };
// Likelihood of each stay length in nights
const STAY_LENGTHS = [[1, 12], [2, 24], [3, 22], [4, 15], [5, 10], [6, 7], [7, 10]];
// Likelihood of each review rating
const RATINGS = [[5, 50], [4, 32], [3, 12], [2, 6]];

const REVIEW_TEXT = {
	5: [
		["Extraordinary stay", "Every detail was considered. The staff remembered our names from the first evening."],
		["Worth every cent", "Spotless room, wonderful bed and the harbour view at sunrise was unforgettable."],
		["We'll be back", "Check-in was effortless and the concierge sorted a last-minute dinner booking for us."],
		["Pure luxury", "Beautifully appointed and so quiet. Best night's sleep we've had in years."],
	],
	4: [
		["Lovely stay", "Great room and friendly staff. Breakfast could start a little earlier."],
		["Very comfortable", "Comfortable and well located. The rainfall shower was a highlight."],
		["Would recommend", "Excellent service overall; our room took a while to be ready on arrival."],
	],
	3: [
		["Good but not perfect", "Nice room, but it was noisier than expected on a Saturday night."],
		["Decent", "Clean and comfortable. For the price we expected a few more touches."],
	],
	2: [
		["Disappointing", "The air conditioning struggled and it took two calls to get it looked at."],
	],
};

// Small, seedable random number generator so the data is repeatable
function makeRandom(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function weighted(rand, options) {
	const total = options.reduce((sum, [, w]) => sum + w, 0);
	let r = rand() * total;
	for (const [value, w] of options) if ((r -= w) < 0) return value;
	return options[options.length - 1][0];
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const pad = (n) => String(n).padStart(2, "0");
const dayName = (date) => hotelNow(hotelTimeToMs(date, "12:00")).weekday;

// Which staff member was on shift on a date at a time ("HH:MM")
function staffOnShift(date, time) {
	const day = dayName(date);
	return ROTA.find((s) => s.days.includes(day) && s.shiftStart <= time && time < s.shiftEnd);
}

// Builds the whole data set. `nowMs` fixes "today", so tests can use any date.
function generate({ rooms, users, nowMs = Date.now(), seed = SEED }) {
	const rand = makeRandom(seed);
	const today = hotelNow(nowMs).date;
	// Bookings are never dated after midnight this morning, so running this
	// again on the same day gives exactly the same data
	const latestCreated = hotelTimeToMs(today, "00:00") - 60000;
	const start = addDays(today, -DAYS_BACK);
	const end = addDays(today, DAYS_AHEAD);
	const passwordHash =
		users.find((u) => u.id === "u001")?.password || bcrypt.hashSync("password", 10);

	// Keep every existing account; add demo staff and guests (replacing any
	// from an earlier run)
	const kept = users.filter((u) => !u.id.startsWith("ug") && !DEMO_STAFF.some((s) => s.id === u.id));
	const demoStaff = DEMO_STAFF.map((s) => ({ ...s, password: passwordHash, role: "staff" }));
	const guests = GUEST_NAMES.map((name, i) => ({
		id: `ug${String(i + 1).padStart(3, "0")}`,
		name,
		email: `${name.toLowerCase().replace(/[^a-z ]/g, "").replace(/ /g, ".")}@example.com`,
		password: passwordHash,
		role: "customer",
	}));
	const jane = kept.find((u) => u.id === "u001");
	const bookers = jane ? [...guests, jane] : guests;

	const bookings = [];
	const checkins = [];
	const usedIds = new Set();
	const uniqueId = (prefix, ms) => {
		let id = `${prefix}${ms}`;
		while (usedIds.has(id)) id = `${prefix}${++ms}`;
		usedIds.add(id);
		return id;
	};

	for (const room of rooms) {
		let date = start;
		while (date < end) {
			const weekend = ["Friday", "Saturday"].includes(dayName(date));
			const demand = FLOOR_DEMAND[room.floor] + (weekend ? 0.12 : 0);
			if (rand() > demand) {
				date = addDays(date, 1); // an empty night
				continue;
			}
			const nights = weighted(rand, STAY_LENGTHS);
			const checkIn = date;
			const checkOut = addDays(checkIn, nights);
			date = checkOut;

			// Booked between a few days and several weeks ahead, never in the future
			const lead = 1 + Math.floor(rand() * rand() * 45);
			let createdDate = addDays(checkIn, -lead);
			let createdMs = hotelTimeToMs(createdDate, `${pad(8 + Math.floor(rand() * 14))}:${pad(Math.floor(rand() * 60))}`);
			if (createdMs > latestCreated) createdMs = latestCreated - Math.floor(rand() * 12 * 3600000);

			const r = rand();
			let status;
			if (checkOut <= today) status = r < 0.08 ? "cancelled" : r < 0.11 ? "booked" : "completed"; // "booked" here = no-show
			else if (checkIn === today) status = r < 0.05 ? "cancelled" : "booked"; // arriving today
			else if (checkIn < today) status = r < 0.04 ? "booked" : "staying"; // a few late arrivals
			else status = r < 0.06 ? "cancelled" : "booked";

			const guest = rand() < 0.05 && jane ? jane : pick(rand, bookers);
			const booking = {
				id: uniqueId("b", createdMs),
				userId: guest.id,
				userName: guest.name,
				guestEmail: guest.email,
				roomId: room.id,
				roomType: room.type,
				floor: room.floor,
				checkIn,
				checkOut,
				nights,
				total: nights * room.price,
				status,
				createdAt: new Date(createdMs).toISOString(),
			};
			bookings.push(booking);

			// Stays that happened (or are happening) were checked in by whoever
			// was on shift that afternoon
			if (status === "completed" || status === "staying") {
				// Arrivals from 10 am (early check-ins, handled by the morning shift)
				// until 8 pm, so every shift does its share
				let time = `${pad(10 + Math.floor(rand() * 10))}:${pad(Math.floor(rand() * 60))}`;
				let staff = staffOnShift(checkIn, time);
				if (!staff) {
					time = "15:30";
					staff = staffOnShift(checkIn, time) || ROTA[0];
				}
				const ms = hotelTimeToMs(checkIn, time);
				checkins.push({
					id: uniqueId("ci", ms),
					bookingId: booking.id,
					userId: guest.id,
					guestName: guest.name,
					guestEmail: guest.email,
					roomId: room.id,
					roomType: room.type,
					floor: room.floor,
					checkInTime: new Date(ms).toISOString(),
					checkOutDate: checkOut,
					total: booking.total,
					status: status === "staying" ? "staying" : "completed",
					attendingStaff: staff.staffName,
					handledBy: staff.staffId,
				});
			}
		}
	}

	bookings.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	checkins.sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));

	// About one in twelve finished stays leaves a review
	const reviews = bookings
		.filter((b) => b.status === "completed" && rand() < 0.08)
		.sort((a, b) => a.checkOut.localeCompare(b.checkOut))
		.map((b, i) => {
			const rating = weighted(rand, RATINGS);
			const [title, comment] = pick(rand, REVIEW_TEXT[rating]);
			return {
				id: `r${String(i + 1).padStart(3, "0")}`,
				guestName: b.userName,
				roomId: b.roomId,
				roomType: b.roomType,
				rating,
				title,
				comment,
				date: b.checkOut,
			};
		});

	return {
		users: [...kept, ...demoStaff, ...guests],
		bookings,
		checkins,
		reviews,
		shifts: ROTA,
	};
}

module.exports = { generate };

// ---------- Run from the command line ----------
if (require.main === module) {
	const { DATA_DIR, dataFile } = require("../backend/config/paths");
	const read = (name) => JSON.parse(fs.readFileSync(dataFile(name), "utf8"));
	const write = (name, data) => fs.writeFileSync(dataFile(name), JSON.stringify(data, null, 2));

	// Back up the current data first: to DATA_BACKUP_DIR from .env if set,
	// otherwise the computer's temp folder
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupRoot = process.env.DATA_BACKUP_DIR || os.tmpdir();
	const backup = path.join(backupRoot, `hotel-data-backup-${stamp}`);
	fs.cpSync(DATA_DIR, backup, { recursive: true });

	const data = generate({ rooms: read("rooms.json"), users: read("users.json") });
	write("users.json", data.users);
	write("bookings.json", data.bookings);
	write("checkins.json", data.checkins);
	write("reviews.json", data.reviews);
	write("shifts.json", data.shifts);

	const count = (status) => data.bookings.filter((b) => b.status === status).length;
	console.log(`Demo data written to ${DATA_DIR}
  ${data.bookings.length} bookings (${count("completed")} completed, ${count("staying")} staying now, ${count("booked")} booked/no-show, ${count("cancelled")} cancelled)
  ${data.checkins.length} check-ins, ${data.reviews.length} reviews, ${data.users.length} accounts
Previous data backed up to ${backup}`);
}
