const roomRepo = require("../repositories/room.repository");
const checkinRepo = require("../repositories/checkin.repository");

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

function withStatus(room, occupied = occupiedRoomIds()) {
	return { ...room, status: occupied.has(room.id) ? "occupied" : "available" };
}

function getRooms() {
	const occupied = occupiedRoomIds();
	return roomRepo.getAll().map((r) => withStatus(r, occupied));
}

function getRoom(id) {
	const room = roomRepo.findById(id);
	return room ? withStatus(room) : null;
}

module.exports = { getRooms, getRoom, withStatus };
