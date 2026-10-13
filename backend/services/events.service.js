const { EventEmitter } = require("events");

// Announces that hotel data changed (a booking, check-in, room edit...), so
// open dashboards can refresh themselves. Carries only which file changed,
// never the data itself.
const bus = new EventEmitter();
bus.setMaxListeners(100); // one listener per open dashboard

function dataChanged(what) {
	bus.emit("change", { what, at: Date.now() });
}

function onChange(listener) {
	bus.on("change", listener);
	return () => bus.off("change", listener);
}

module.exports = { dataChanged, onChange };
