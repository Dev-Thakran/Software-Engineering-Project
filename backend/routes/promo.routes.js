const express = require("express");
const promoRepo = require("../repositories/promo.repository");
const router = express.Router();

// Public check used by the booking form's "Apply" button. The server
// re-checks the code when the booking is made, so this only previews it.
router.get("/:code", (req, res) => {
	const promo = promoRepo.findUsable(req.params.code);
	if (!promo) return res.status(404).json({ error: "That code isn't valid or has expired" });
	res.json(promo);
});

module.exports = router;
