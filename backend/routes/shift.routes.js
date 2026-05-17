const express = require('express')
const fs      = require('fs')
const path    = require('path')
const { authenticate } = require('../middleware/auth.middleware')
const router  = express.Router()

// Returns shifts belonging to the logged-in staff member
router.get('/mine', authenticate, (req, res) => {
    const shifts = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/shifts.json'), 'utf8'))
    const mine   = shifts.filter(s => s.staffId === req.user.id)
    res.json(mine)
})

module.exports = router