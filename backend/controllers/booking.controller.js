const bookingRepo = require("../repositories/booking.repository");
const roomRepo = require("../repositories/room.repository");
const userRepo = require("../repositories/user.repository");
const availability = require("../services/availability.service");
const promoRepo = require("../repositories/promo.repository");
const { getPlan } = require("../config/rate-plans");

const NON_REFUNDABLE =
	"Advance purchase bookings are non-refundable and can't be changed online - please call reception on +64 9 123 4567";

// Adults (at least 1) and children (0 or more) - everyone counts toward the
// room's guest limit. Older callers that send only "guests" are read as adults.
// Returns { adults, children, guests } or { error }.
function readParty(body, room) {
	const has = (v) => v !== undefined && v !== null && v !== "";
	const adults = Number(has(body.adults) ? body.adults : has(body.guests) ? body.guests : 1);
	const children = Number(has(body.children) ? body.children : 0);
	if (!Number.isInteger(adults) || adults < 1)
		return { error: "At least one adult is needed for a booking" };
	if (!Number.isInteger(children) || children < 0)
		return { error: "Children must be a whole number (0 or more)" };
	const max = availability.MAX_GUESTS[room.type] || 2;
	if (adults + children > max)
		return { error: `Room ${room.id} sleeps up to ${max} ${max === 1 ? "guest" : "guests"} (children count too)` };
	return { adults, children, guests: adults + children };
}

// Room total for a stay: the rate plan's discount comes off first, then any
// promo code off what's left. Neither touches the $30 taxes & fees, which are
// added at payment. e.g. $1,140 -> advance 10% -> $1,026 -> EXPO2026 10% -> $923
function priceStay(room, nights, { ratePercent = 0, promoPercent = 0 } = {}) {
	const fullPrice = nights * room.price;
	const rateDiscount = ratePercent ? Math.round((fullPrice * ratePercent) / 100) : 0;
	const afterRate = fullPrice - rateDiscount;
	const discount = promoPercent ? Math.round((afterRate * promoPercent) / 100) : 0;
	return { fullPrice, rateDiscount, discount, total: afterRate - discount };
}

function getAll(req, res) {
	// Staff and managers see all bookings; customers see only their own
	const bookings =
		req.user.role === "customer"
			? bookingRepo.findByUser(req.user.id)
			: bookingRepo.getAll();
	res.json(bookings);
}

function create(req, res) {
	const { roomId, checkIn, checkOut } = req.body;
	if (!roomId || !checkIn || !checkOut)
		return res
			.status(400)
			.json({ error: "roomId, checkIn, and checkOut are required" });
	const invalid = availability.validateStay(checkIn, checkOut);
	if (invalid) return res.status(400).json({ error: invalid });
	const room = roomRepo.findById(roomId);
	if (!room) return res.status(404).json({ error: "Room not found" });
	if (!availability.isRoomFree(roomId, checkIn, checkOut))
		return res
			.status(409)
			.json({ error: "Room is already booked for those dates" });
	const party = readParty(req.body, room);
	if (party.error) return res.status(400).json({ error: party.error });
	let promo = null;
	if (req.body.promoCode) {
		promo = promoRepo.findUsable(req.body.promoCode);
		if (!promo) return res.status(400).json({ error: "That promo code isn't valid or has expired" });
	}
	const plan = getPlan(req.body.ratePlan || undefined);
	if (!plan) return res.status(400).json({ error: "Choose the Flexible or Advance purchase rate" });
	const nights = availability.nightsBetween(checkIn, checkOut);
	const price = priceStay(room, nights, { ratePercent: plan.discountPercent, promoPercent: promo?.percent });
	const booking = {
		id: "b" + Date.now(),
		userId: req.user.id,
		userName: req.user.name,
		guestEmail: userRepo.findById(req.user.id)?.email || "",
		roomId,
		roomType: room.type,
		floor: room.floor,
		checkIn,
		checkOut,
		nights,
		adults: party.adults,
		children: party.children,
		guests: party.guests,
		ratePlan: plan.id,
		...(plan.discountPercent ? { ratePercent: plan.discountPercent, rateDiscount: price.rateDiscount } : {}),
		...(promo ? { promoCode: promo.code, promoPercent: promo.percent, discount: price.discount } : {}),
		...(price.total !== price.fullPrice ? { fullPrice: price.fullPrice } : {}),
		total: price.total,
		status: "booked",
		createdAt: new Date().toISOString(),
	};
	bookingRepo.save(booking);
	res.status(201).json(booking);
}

// Staff and managers can cancel a booking that hasn't checked in yet.
// Guests can cancel their own, up to the day before arrival.
// Check-out goes through /checkins so the room is freed correctly.
function updateStatus(req, res) {
	const { status } = req.body;
	if (status !== "cancelled")
		return res.status(400).json({ error: "Invalid status" });
	const existing = bookingRepo.findById(req.params.id);
	if (!existing) return res.status(404).json({ error: "Booking not found" });
	if (req.user.role === "customer") {
		if (existing.userId !== req.user.id)
			return res.status(404).json({ error: "Booking not found" });
		if (existing.status !== "booked")
			return res.status(409).json({ error: "Only bookings awaiting check-in can be cancelled" });
		if (existing.ratePlan === "advance") return res.status(409).json({ error: NON_REFUNDABLE });
		if (existing.checkIn <= availability.today())
			return res.status(409).json({
				error: "Same-day cancellations need the front desk - please call us on +64 9 123 4567",
			});
	}
	if (existing.status !== "booked")
		return res
			.status(409)
			.json({ error: "Only bookings awaiting check-in can be cancelled" });
	res.json(bookingRepo.update(existing.id, { status }));
}

// A guest moves their own upcoming stay to new dates, up to the same cut-off
// as cancelling (the day before arrival). The stay is re-priced at today's
// room price, keeping any promo; the difference is settled at reception.
function changeDates(req, res) {
	const { checkIn, checkOut } = req.body || {};
	const existing = bookingRepo.findById(req.params.id);
	if (!existing || existing.userId !== req.user.id)
		return res.status(404).json({ error: "Booking not found" });
	if (existing.status !== "booked")
		return res.status(409).json({ error: "Only upcoming bookings can be changed" });
	if (existing.ratePlan === "advance") return res.status(409).json({ error: NON_REFUNDABLE });
	if (existing.checkIn <= availability.today())
		return res.status(409).json({
			error: "Same-day changes need the front desk - please call us on +64 9 123 4567",
		});
	const invalid = availability.validateStay(checkIn, checkOut);
	if (invalid) return res.status(400).json({ error: invalid });
	if (checkIn === existing.checkIn && checkOut === existing.checkOut)
		return res.status(400).json({ error: "Those are already your dates" });
	if (!availability.isRoomFree(existing.roomId, checkIn, checkOut, existing.id))
		return res.status(409).json({ error: `Room ${existing.roomId} is already booked for some of those nights` });
	const room = roomRepo.findById(existing.roomId);
	if (!room) return res.status(404).json({ error: "Room not found" });

	const nights = availability.nightsBetween(checkIn, checkOut);
	const price = priceStay(room, nights, { ratePercent: existing.ratePercent, promoPercent: existing.promoPercent });
	const changes = [
		...(existing.changes || []),
		{ at: new Date().toISOString(), from: { checkIn: existing.checkIn, checkOut: existing.checkOut, total: existing.total } },
	];
	const updated = bookingRepo.update(existing.id, {
		checkIn,
		checkOut,
		nights,
		total: price.total,
		...(existing.promoCode ? { discount: price.discount } : {}),
		...(existing.ratePercent ? { rateDiscount: price.rateDiscount } : {}),
		...(price.total !== price.fullPrice ? { fullPrice: price.fullPrice } : {}),
		changes,
	});
	res.json({ booking: updated, difference: price.total - existing.total });
}

module.exports = { getAll, create, updateStatus, changeDates };
