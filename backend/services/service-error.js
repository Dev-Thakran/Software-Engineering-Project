// Error carrying the HTTP status a route should respond with
class ServiceError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

module.exports = ServiceError;
