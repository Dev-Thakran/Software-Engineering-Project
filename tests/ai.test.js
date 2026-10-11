// ============================================================
// tests/ai.test.js — The AI assistant, using a scripted fake model
// so no API key or network is needed
// ============================================================

const { writeData, readData } = require("./helpers/temp-data");
const assistant = require("../backend/ai/assistant");
const { toolsForRole } = require("../backend/ai/tools");
const { toClaudeMessages } = require("../backend/ai/providers/claude");
const rooms = require("../backend/services/room.service");

const staff = { id: "u002", name: "Mike Tane", role: "staff" };
const customer = { id: "u001", name: "Jane Thompson", role: "customer" };
const manager = { id: "u003", name: "Sarah Kim", role: "manager" };

function inDays(days) {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toLocaleDateString("en-CA");
}

// A fake model that returns the given replies in order and records
// what it was sent
function fakeModel(...replies) {
	const calls = [];
	return {
		calls,
		async chat(request) {
			calls.push({ ...request, messages: [...request.messages] });
			const next = replies.shift() || { text: "Done." };
			return { text: next.text || "", toolCalls: next.toolCalls || [], raw: null };
		},
	};
}

const toolCall = (name, input = {}) => ({
	toolCalls: [{ id: `call_${name}`, name, input }],
});

beforeEach(() => {
	writeData("bookings.json", [
		{
			id: "bT",
			userId: "u001",
			userName: "Jane Thompson",
			roomId: "203",
			roomType: "Deluxe Double",
			floor: 2,
			checkIn: inDays(0),
			checkOut: inDays(2),
			nights: 2,
			total: 378,
			status: "booked",
			createdAt: new Date().toISOString(),
		},
	]);
	writeData("checkins.json", []);
	[staff, customer, manager].forEach((u) => assistant.resetConversation(u.id));
});

test("each role only gets its own tools", () => {
	const names = (role) => toolsForRole(role).map((t) => t.name);
	expect(names("customer")).toContain("propose_booking");
	expect(names("customer")).not.toContain("propose_checkin");
	expect(names("staff")).toContain("propose_checkin");
	expect(names("staff")).not.toContain("get_overview");
	expect(names("manager").some((n) => n.startsWith("propose_"))).toBe(false);
	expect(names("visitor")).toEqual([]);
});

test("staff can check a guest in through the chat after confirming", async () => {
	const model = fakeModel(
		toolCall("get_checkin_queue"),
		toolCall("propose_checkin", { booking: "bT" }),
		{ text: "Jane Thompson is ready to check in." },
	);
	const result = await assistant.chat(staff, "Who's waiting?", model);

	// The server words the reply itself, using the card's button label
	expect(result.reply).toBe(
		"Please check the details below and click **Check in** to go ahead.",
	);
	expect(result.actions).toHaveLength(1);
	expect(result.actions[0].title).toBe("Check in Jane Thompson");
	// The queue tool's result reached the model
	const toolMsg = model.calls[1].messages.find((m) => m.role === "tool");
	expect(toolMsg.content).toContain("bT");
	// Nothing changes until Confirm is clicked
	expect(readData("bookings.json")[0].status).toBe("booked");

	const done = assistant.confirmAction(staff, result.actions[0].id);
	expect(done.refresh).toBe(true);
	expect(readData("bookings.json")[0].status).toBe("staying");
	expect(rooms.getRoom("203").status).toBe("occupied");

	// A card can only be used once
	expect(() => assistant.confirmAction(staff, result.actions[0].id)).toThrow(/expired|used/);
});

test("another user can't confirm someone else's card", async () => {
	const model = fakeModel(toolCall("propose_checkin", { booking: "bT" }), { text: "OK" });
	const { actions } = await assistant.chat(staff, "Check in Jane", model);
	expect(() => assistant.confirmAction(customer, actions[0].id)).toThrow();
	expect(readData("bookings.json")[0].status).toBe("booked");
});

test("customer booking card sends them to the payment form", async () => {
	const model = fakeModel(
		toolCall("propose_booking", {
			roomId: "101",
			checkIn: inDays(5),
			checkOut: inDays(7),
			guests: 1,
		}),
		{ text: "Here's your room." },
	);
	const { actions } = await assistant.chat(customer, "Book 101", model);
	expect(actions[0].lines).toContain("$198 + $30 tax = $228");

	const done = assistant.confirmAction(customer, actions[0].id);
	expect(done.redirect).toBe(
		`/pages/bookingform.html?room=101&checkIn=${inDays(5)}&checkOut=${inDays(7)}&guests=1`,
	);
	// The booking itself is only created after payment on the form
	expect(readData("bookings.json")).toHaveLength(1);
});

test("a tool error is reported to the model instead of creating a card", async () => {
	const model = fakeModel(
		toolCall("propose_booking", {
			roomId: "203",
			checkIn: inDays(0),
			checkOut: inDays(1),
			guests: 1,
		}),
		{ text: "That room is taken." },
	);
	const { actions } = await assistant.chat(customer, "Book 203 tonight", model);
	expect(actions).toHaveLength(0);
	const toolMsg = model.calls[1].messages.find((m) => m.role === "tool");
	expect(toolMsg.isError).toBe(true);
	expect(toolMsg.content).toMatch(/already booked/);
});

test("a customer can't use staff tools even if the model asks for one", async () => {
	const model = fakeModel(toolCall("propose_checkin", { booking: "bT" }), { text: "Sorry." });
	const { actions } = await assistant.chat(customer, "Check me in", model);
	expect(actions).toHaveLength(0);
	const toolMsg = model.calls[1].messages.find((m) => m.role === "tool");
	expect(toolMsg.content).toMatch(/Unknown tool/);
});

test("a failed model call leaves the conversation unchanged", async () => {
	await assistant.chat(manager, "Hi", fakeModel({ text: "Hello" }));
	const broken = { chat: () => Promise.reject(new Error("network down")) };
	await expect(assistant.chat(manager, "Summarise", broken)).rejects.toThrow("network down");

	const model = fakeModel({ text: "Fine" });
	await assistant.chat(manager, "Again", model);
	const sent = model.calls[0].messages.map((m) => m.content);
	expect(sent).toEqual(["Hi", "Hello", "Again"]);
});

test("staff greeting offers a check-in card for each waiting guest", () => {
	const greeting = assistant.greeting(staff);
	expect(greeting.text).toMatch(/1 guest is waiting/);
	expect(greeting.actions[0].title).toBe("Check in Jane Thompson");
});

test("manager tools return the dashboard numbers", () => {
	const overview = toolsForRole("manager").find((t) => t.name === "get_overview");
	const result = overview.run({}, { user: manager });
	expect(result.totalBookings).toBe(1);
	expect(result.totalRevenue).toBe(378);
});

test("Claude adapter groups tool results and replays Claude's own blocks", () => {
	const claudeBlocks = [
		{ type: "thinking", thinking: "", signature: "sig" },
		{ type: "tool_use", id: "t1", name: "a", input: {} },
		{ type: "tool_use", id: "t2", name: "b", input: {} },
	];
	const converted = toClaudeMessages([
		{ role: "user", content: "Hi" },
		{
			role: "assistant",
			content: "",
			toolCalls: [],
			raw: { provider: "claude", content: claudeBlocks },
		},
		{ role: "tool", toolCallId: "t1", name: "a", content: "1" },
		{ role: "tool", toolCallId: "t2", name: "b", content: "oops", isError: true },
	]);
	expect(converted).toHaveLength(3);
	expect(converted[1].content).toBe(claudeBlocks);
	expect(converted[2]).toEqual({
		role: "user",
		content: [
			{ type: "tool_result", tool_use_id: "t1", content: "1" },
			{ type: "tool_result", tool_use_id: "t2", content: "oops", is_error: true },
		],
	});
});

test("staff tools find guests by name, and explain when they can't", async () => {
	const model = fakeModel(
		toolCall("propose_checkin", { booking: "jane thompson" }),
		{ text: "OK" },
	);
	const { actions } = await assistant.chat(staff, "Check in Jane", model);
	expect(actions[0].title).toBe("Check in Jane Thompson");

	const checkinTool = toolsForRole("staff").find((t) => t.name === "propose_checkin");
	const ctx = { user: staff, propose: () => {} };
	expect(() => checkinTool.run({ booking: "JaneThompson123" }, ctx)).toThrow(
		/No guest due to check in today matches .* bT \/ Jane Thompson/,
	);
});
