// ============================================================
// tests/room-prices.test.js — The manager changing room prices,
// one room at a time or a whole floor at once
// ============================================================

const { writeData, readData } = require("./helpers/temp-data");
const app = require("../backend/server");
const http = require("http");
const axios = require("axios");

let server;
let BASE;
const originalRooms = readData("rooms.json");

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

function inDays(days) {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toLocaleDateString("en-CA");
}

const login = async (email) => (await api().post("/auth/login", { email, password: "password" })).data.token;

let manager;
let staff;
let guest;
beforeAll(async () => {
	manager = await login("manager@email.co.nz");
	staff = await login("staff@email.co.nz");
	guest = await login("jane@email.com");
});

beforeEach(() => {
	writeData("rooms.json", originalRooms);
	writeData("bookings.json", []);
	writeData("checkins.json", []);
});

const priceOf = (id) => readData("rooms.json").find((r) => r.id === id).price;

test("the manager can change one room's price", async () => {
	const res = await api(manager).patch("/rooms/301", { price: 240 });
	expect(res.status).toBe(200);
	expect(res.data.price).toBe(240);
	expect(priceOf("301")).toBe(240);
	expect(priceOf("302")).toBe(originalRooms.find((r) => r.id === "302").price);
});

test("staff and guests can't change prices", async () => {
	for (const token of [staff, guest]) {
		expect((await api(token).patch("/rooms/301", { price: 1 })).status).toBe(403);
		expect((await api(token).patch("/rooms/floors/3", { price: 1 })).status).toBe(403);
	}
	expect((await api().patch("/rooms/301", { price: 1 })).status).toBe(401);
	expect(priceOf("301")).toBe(originalRooms.find((r) => r.id === "301").price);
});

test("a floor price changes every room on that floor and nothing else", async () => {
	const res = await api(manager).patch("/rooms/floors/1", { price: 115 });
	expect(res.status).toBe(200);
	const rooms = readData("rooms.json");
	const floor1 = rooms.filter((r) => r.floor === 1);
	expect(res.data).toHaveLength(floor1.length);
	expect(floor1.every((r) => r.price === 115)).toBe(true);
	rooms
		.filter((r) => r.floor !== 1)
		.forEach((r) => expect(r.price).toBe(originalRooms.find((o) => o.id === r.id).price));
});

test("invalid prices are refused", async () => {
	for (const price of [0, -5, 10.5, "abc", "", 20000, null, true]) {
		expect((await api(manager).patch("/rooms/301", { price })).status).toBe(400);
		expect((await api(manager).patch("/rooms/floors/3", { price })).status).toBe(400);
	}
	expect((await api(manager).patch("/rooms/301", { price: "250" })).status).toBe(200);
});

test("unknown rooms and floors get 404", async () => {
	expect((await api(manager).patch("/rooms/999", { price: 100 })).status).toBe(404);
	expect((await api(manager).patch("/rooms/floors/9", { price: 100 })).status).toBe(404);
});

test("existing bookings keep their price; new bookings use the new one", async () => {
	const before = await api(guest).post("/bookings", { roomId: "201", checkIn: inDays(10), checkOut: inDays(12) });
	const oldTotal = before.data.total;
	await api(manager).patch("/rooms/201", { price: 300 });
	const after = await api(guest).post("/bookings", { roomId: "201", checkIn: inDays(20), checkOut: inDays(22) });
	expect(after.data.total).toBe(600);
	expect(readData("bookings.json").find((b) => b.id === before.data.id).total).toBe(oldTotal);
});
