const express = require("express");
const fs      = require("fs");
const path    = require("path");
const ctrl    = require("../controllers/room.controller");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const router  = express.Router();

// Public amenities endpoint — MUST be before /:id to avoid route conflict
const amenitiesPath = path.join(__dirname, "../data/amenities.json");
router.get("/:id/amenities", (req, res) => {
    const amenities = JSON.parse(fs.readFileSync(amenitiesPath, "utf8"));
    const found     = amenities.find(a => a.roomId === req.params.id);
    res.json(found ? found.amenities : []);
});

router.get("/", ctrl.getAll);    // public
router.get("/:id", ctrl.getOne); // public — must come after /:id/amenities
router.post("/", authenticate, requireRole("manager"), ctrl.addRoom);
router.patch("/:id", authenticate, requireRole("manager", "staff"), ctrl.updateRoom);
router.delete("/:id", authenticate, requireRole("manager"), ctrl.deleteRoom);

module.exports = router;