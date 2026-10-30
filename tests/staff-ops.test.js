// ============================================================
// tests/staff-ops.test.js — Arrival time and requests, safe
// check-ins, and housekeeping after check-out
// ============================================================

const { writeData, readData } = require("./helpers/temp-data");
const app = require("../backend/server");
const checkins = require("../backend/services/checkin.service");
const http = require("http");
const axios = require("axios");

let server;
let BASE;

beforeAll((done) => {
	server = http.createServer(app);
	server.listen(0, () => {
		BASE = `http://localhost:${server.address().port}`;
		done();
	});
});
afterAll((done) => {
	server.close(done);
});

function api(token) {
	return axios.create({
		baseURL: BASE,
		validateStatus: () => true,
		timeout: 10000,
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	});
}

const hotelDate = (days = 0) =>
	new Date(Date.now() + days * 86400000).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });

const login = async (email) => (await api().post("/auth/login", { email, password: "password" })).data.token;

let jane;
let manager; // managers are never blocked by shifts
beforeAll(async () => {
	jane = await login("jane@email.com");
	manager = await login("manager@email.co.nz");
});

beforeEach(() => {
	writeData("bookings.json", []);
	writeData("checkins.json", []);
	writeData(
		"rooms.json",
		readData("rooms.json").map(({ housekeeping, housekeepingSince, cleanedBy, ...room }) => room),
	);
});

// A guest who should have left yesterday but is still checked in to the room
function overdueGuestIn(roomId) {
	writeData("checkins.json", [
		{
			id: "ci-overdue",
			bookingId: "b-old",
			userId: "ug999",
			guestName: "Ella Thompson",
			roomId,
			roomType: "Standard Single",
			floor: 1,
			checkInTime: new Date(Date.now() - 3 * 86400000).toISOString(),
			checkOutDate: hotelDate(-1),
			total: 297,
			status: "staying",
		},
	]);
}

const bookToday = (extra = {}) =>
	api(jane).post("/bookings", { roomId: "101", checkIn: hotelDate(0), checkOut: hotelDate(1), adults: 1, ...extra });

// - Arrival time and requests -------------------------------
test("arrival time and requests are saved, tidied and capped", async () => {
	const res = await bookToday({ arrivalTime: "17:00–19:00", requests: `  <b>High floor</b> please ${"x".repeat(400)}` });
	expect(res.status).toBe(201);
	expect(res.data.arrivalTime).toBe("17:00–19:00");
	expect(res.data.requests.startsWith("bHigh floor/b please")).toBe(true);
	expect(res.data.requests).toHaveLength(300);
	expect(res.data.requests).not.toMatch(/[<>]/);
});

test("an arrival time that isn't on the list is refused", async () => {
	expect((await bookToday({ arrivalTime: "3am" })).status).toBe(400);
	expect((await bookToday({ requests: { evil: true } })).status).toBe(400);
});

test("bookings without the extras don't store empty fields", async () => {
	const { data } = await bookToday();
	expect(data).not.toHaveProperty("arrivalTime");
	expect(data).not.toHaveProperty("requests");
});

// - Safe check-ins -------------------------------------------
test("a guest can't be checked in to a room someone is still staying in", async () => {
	overdueGuestIn("101");
	const { data: booking } = await bookToday();

	const { data: queue } = await api(manager).get("/checkins/queue");
	const arrival = queue.bookings.find((b) => b.id === booking.id);
	expect(arrival.roomReady).toBe(false);
	expect(arrival.roomNotReady).toMatch(/still has a guest staying \(Ella Thompson/);

	const res = await api(manager).post(`/checkins/checkin/${booking.id}`);
	expect(res.status).toBe(409);
	expect(res.data.error).toMatch(/Check them out first/);
});

// - Housekeeping ---------------------------------------------
test("check-out records who and when, and the room needs cleaning before the next check-in", async () => {
	overdueGuestIn("101");
	const { data: booking } = await bookToday();

	expect((await api(manager).post("/checkins/checkout/ci-overdue")).status).toBe(200);
	const done = readData("checkins.json").find((c) => c.id === "ci-overdue");
	expect(done.status).toBe("completed");
	expect(done.checkedOutBy).toBeTruthy();
	expect(Date.parse(done.checkOutTime)).not.toBeNaN();

	const { data: toClean } = await api(manager).get("/checkins/housekeeping");
	expect(toClean.map((r) => r.id)).toEqual(["101"]);

	const blocked = await api(manager).post(`/checkins/checkin/${booking.id}`);
	expect(blocked.status).toBe(409);
	expect(blocked.data.error).toMatch(/needs cleaning/);

	expect((await api(manager).post("/checkins/housekeeping/101")).status).toBe(200);
	expect((await api(manager).post("/checkins/housekeeping/101")).status).toBe(409); // already clean
	expect((await api(manager).get("/checkins/housekeeping")).data).toEqual([]);

	const ok = await api(manager).post(`/checkins/checkin/${booking.id}`);
	expect(ok.status).toBe(200);
	expect(ok.data.roomId).toBe("101");
});

test("guests can't see or change housekeeping", async () => {
	expect((await api(jane).get("/checkins/housekeeping")).status).toBe(403);
	expect((await api(jane).post("/checkins/housekeeping/101")).status).toBe(403);
	expect((await api(manager).post("/checkins/housekeeping/999")).status).toBe(404);
});

test("undoing a check-out puts the room's housekeeping state back", async () => {
	overdueGuestIn("101");
	const user = { id: "u001", name: "Test Manager", role: "manager" };
	checkins.checkOut("ci-overdue", user);
	expect(readData("rooms.json").find((r) => r.id === "101").housekeeping).toBe("dirty");

	checkins.undoCheckOut("ci-overdue", user);
	expect(readData("rooms.json").find((r) => r.id === "101").housekeeping).toBe("clean");
	const back = readData("checkins.json").find((c) => c.id === "ci-overdue");
	expect(back.status).toBe("staying");
	expect(back).not.toHaveProperty("checkOutTime");
});
