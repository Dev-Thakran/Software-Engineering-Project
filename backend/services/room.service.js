const roomRepo = require("../repositories/room.repository");
const checkinRepo = require("../repositories/checkin.repository");
const referenceRepo = require("../repositories/reference.repository");
const { MAX_GUESTS } = require("./availability.service");

// A room's status isn't stored - it is "occupied" exactly when a guest is
// checked in to it, so it can never drift out of step with the check-ins.
function occupiedRoomIds() {
	return new Set(
		checkinRepo
			.getAll()
			.filter((c) => c.status === "staying")
			.map((c) => c.roomId),
	);
}

// Each room carries its floor's content (size, bed, view, story, photos) so
// every page and Aria describe it the same way
function withStatus(room, occupied = occupiedRoomIds(), tiers = referenceRepo.getTiers()) {
	const tier = tiers.floors?.[String(room.floor)];
	return {
		...room,
		accessible: Boolean(room.accessible),
		...(room.accessible ? { accessibleFeatures: tiers.accessibleFeatures || [] } : {}),
		...(tier ? { tier } : {}),
		maxGuests: MAX_GUESTS[room.type] || 2,
		status: occupied.has(room.id) ? "occupied" : "available",
	};
}

function getRooms() {
	const occupied = occupiedRoomIds();
	const tiers = referenceRepo.getTiers();
	return roomRepo.getAll().map((r) => withStatus(r, occupied, tiers));
}

function getRoom(id) {
	const room = roomRepo.findById(id);
	return room ? withStatus(room) : null;
}

module.exports = { getRooms, getRoom, withStatus };
