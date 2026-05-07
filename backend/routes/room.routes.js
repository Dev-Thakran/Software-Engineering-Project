const express = require('express')
const ctrl    = require('../controllers/room.controller')
const { authenticate, requireRole } = require('../middleware/auth.middleware')
const router  = express.Router()

router.get('/',        ctrl.getAll)                                         // public
router.get('/:id',     ctrl.getOne)                                         // public
router.post('/',       authenticate, requireRole('manager'), ctrl.addRoom)
router.patch('/:id',   authenticate, requireRole('manager', 'staff'), ctrl.updateRoom)
router.delete('/:id',  authenticate, requireRole('manager'), ctrl.deleteRoom)

module.exports = router