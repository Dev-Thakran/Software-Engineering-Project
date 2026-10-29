// The two ways to pay for a stay. Change the discount or wording here and the
// booking form, server pricing and cancellation rules all follow.
const RATE_PLANS = {
	flexible: {
		id: "flexible",
		name: "Flexible",
		discountPercent: 0,
		refundable: true,
		summary: "Free cancellation and date changes until 23:59 the day before arrival",
	},
	advance: {
		id: "advance",
		name: "Advance purchase",
		discountPercent: 10,
		refundable: false,
		summary: "10% off the room price. Paid now, non-refundable and can't be changed online",
	},
};

const DEFAULT_PLAN = "flexible";

function getPlan(id) {
	return RATE_PLANS[id ?? DEFAULT_PLAN] || null;
}

module.exports = { RATE_PLANS, DEFAULT_PLAN, getPlan };
