// ============================================================
// tests/live-dashboard.test.js — Demo data generator, and the
// manager dashboard updating live when data changes
// ============================================================

require("./helpers/temp-data");
const http = require("http");
const app = require("../backend/server");
const stats = require("../backend/services/stats.service");
const { generate } = require("../scripts/seed-demo");
const { hotelTimeToMs } = require("../backend/config/hotel-time");

const rooms = require("../backend/data/rooms.json");
const users = require("../backend/data/users.json");

describe("demo data generator", () => {
	// A fixed "now" so the data is the same on every run
	const nowMs = hotelTimeToMs("2026-10-13", "10:00");
	const data = generate({ rooms, users, nowMs });

	test("is repeatable", () => {
		expect(JSON.stringify(generate({ rooms, users, nowMs }))).toBe(JSON.stringify(data));
	});

	test("keeps every existing account and adds demo guests and staff", () => {
		for (const u of users) expect(data.users.find((x) => x.id === u.id)).toBeTruthy();
		const demo = data.users.filter((u) => u.email.endsWith("@example.com"));
		expect(demo.length).toBe(42);
	});

	test("never double-books a room and charges the room's price", () => {
		for (const room of rooms) {
			const stays = data.bookings
				.filter((b) => b.roomId === room.id && b.status !== "cancelled")
				.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
			for (let i = 1; i < stays.length; i++)
				expect(stays[i].checkIn >= stays[i - 1].checkOut).toBe(true);
			for (const b of stays) expect(b.total).toBe(b.nights * room.price);
		}
	});

	test("every stay that happened has a check-in by staff on shift", () => {
		const stayed = data.bookings.filter((b) => ["completed", "staying"].includes(b.status));
		expect(data.checkins).toHaveLength(stayed.length);
		for (const b of stayed) {
			const ci = data.checkins.find((c) => c.bookingId === b.id);
			expect(ci.status).toBe(b.status === "staying" ? "staying" : "completed");
			expect(["u002", "u004", "u005"]).toContain(ci.handledBy);
		}
	});

	test("no booking is made after today began", () => {
		const startOfToday = hotelTimeToMs("2026-10-13", "00:00");
		expect(data.bookings.every((b) => new Date(b.createdAt).getTime() < startOfToday)).toBe(true);
	});
});

describe("live manager dashboard", () => {
	let server;
	let base;
	beforeAll((done) => {
		server = http.createServer(app).listen(0, () => {
			base = `http://localhost:${server.address().port}`;
			done();
		});
	});
	afterAll((done) => {
		server.closeAllConnections();
		server.close(done);
	});

	const login = async (email) =>
		(
			await (
				await fetch(`${base}/auth/login`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email, password: "password" }),
				})
			).json()
		).token;

	// Reads the live stream until a message with this event name arrives
	async function waitForEvent(reader, name, timeoutMs = 3000) {
		const decoder = new TextDecoder();
		let text = "";
		const deadline = Date.now() + timeoutMs;
		// One read stays pending across loops, so no data is ever dropped
		let pending = reader.read();
		while (Date.now() < deadline) {
			const result = await Promise.race([
				pending,
				new Promise((r) => setTimeout(() => r(null), 200)),
			]);
			if (!result) continue; // nothing yet; keep waiting on the same read
			if (result.done) break;
			text += decoder.decode(result.value);
			if (text.includes(`event: ${name}`)) return true;
			pending = reader.read();
		}
		return false;
	}

	test("only managers can listen", async () => {
		const staff = await login("staff@email.co.nz");
		const res = await fetch(`${base}/manager/live`, { headers: { Authorization: `Bearer ${staff}` } });
		expect(res.status).toBe(403);
	});

	test("a new booking is announced and the totals move by exactly its price", async () => {
		const manager = await login("manager@email.co.nz");
		const customer = await login("jane@email.com");
		const controller = new AbortController();
		const res = await fetch(`${base}/manager/live`, {
			headers: { Authorization: `Bearer ${manager}` },
			signal: controller.signal,
		});
		const reader = res.body.getReader();
		expect(await waitForEvent(reader, "ready")).toBe(true);

		const before = stats.getOverview();
		// Far enough ahead that the room is free
		const d = new Date();
		d.setDate(d.getDate() + 200);
		const checkIn = d.toLocaleDateString("en-CA");
		d.setDate(d.getDate() + 3);
		const booking = await (
			await fetch(`${base}/bookings`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer}` },
				body: JSON.stringify({ roomId: "401", checkIn, checkOut: d.toLocaleDateString("en-CA") }),
			})
		).json();
		expect(booking.total).toBe(3 * 380);

		expect(await waitForEvent(reader, "change")).toBe(true);
		const after = stats.getOverview();
		expect(after.totalRevenue - before.totalRevenue).toBe(1140);
		expect(after.totalBookings - before.totalBookings).toBe(1);
		controller.abort();
	});
});
