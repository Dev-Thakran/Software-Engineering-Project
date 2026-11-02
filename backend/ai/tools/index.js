// The tools each role's assistant may use. The role comes from the login
// token, so a customer can never reach staff or manager tools.
const TOOLS = {
	customer: require("./customer"),
	staff: require("./staff"),
	manager: require("./manager"),
};

function toolsForRole(role) {
	return TOOLS[role] || [];
}

module.exports = { toolsForRole };
