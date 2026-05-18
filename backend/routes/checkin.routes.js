const express = require('express')
const fs      = require('fs')
const path    = require('path')
const { authenticate } = require('../middleware/auth.middleware')
const router  = express.Router()

const CHECKINS_FILE = path.join(__dirname, '../data/checkins.json')
const BOOKINGS_FILE = path.join(__dirname, '../data/bookings.json')

function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
}

// Today's check-in count
router.get('/today', authenticate, (req, res) => {
    const checkins = readJSON(CHECKINS_FILE)
    const today    = new Date().toLocaleDateString('en-CA')
    const todays   = checkins.filter(c => c.checkInTime.split('T')[0] === today)
    res.json({ count: todays.length, checkins: todays })
})

// Guests awaiting check-in — pending bookings with today's check-in date
router.get('/queue', authenticate, (req, res) => {
    const bookings = readJSON(BOOKINGS_FILE)
    const today    = new Date().toLocaleDateString('en-CA')
    const queue    = bookings.filter(b => b.checkIn === today && b.status === 'pending')
    res.json({ count: queue.length, bookings: queue })
})

// Currently in residence — confirmed bookings where guest has checked in
router.get('/residence', authenticate, (req, res) => {
    const checkins = readJSON(CHECKINS_FILE)
    const inRes    = checkins.filter(c => c.status === 'checked-in')
    res.json(inRes)
})

module.exports = router