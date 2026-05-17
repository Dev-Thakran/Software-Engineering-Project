const express = require('express')
const fs      = require('fs')
const path    = require('path')
const { authenticate, requireRole } = require('../middleware/auth.middleware')
const router  = express.Router()

function readJSON(file) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../data', file), 'utf8'))
}

// Stats overview
router.get('/stats', authenticate, requireRole('manager'), (req, res) => {
    const bookings = readJSON('bookings.json')
    const rooms    = readJSON('rooms.json')
    const reviews  = readJSON('reviews.json')

    const totalRevenue   = bookings.reduce((sum, b) => sum + (b.total || 0), 0)
    const occupiedRooms  = rooms.filter(r => r.status === 'occupied').length
    const occupancyPct   = Math.round((occupiedRooms / rooms.length) * 100)
    const avgRating      = reviews.length
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : 0

    res.json({
        totalRevenue,
        occupancyPct,
        totalRooms: rooms.length,
        avgRating,
        totalReviews: reviews.length,
        totalBookings: bookings.length
    })
})

// Top rooms by bookings
router.get('/top-rooms', authenticate, requireRole('manager'), (req, res) => {
    const bookings = readJSON('bookings.json')
    const counts   = {}
    bookings.forEach(b => { counts[b.roomId] = (counts[b.roomId] || 0) + 1 })
    const sorted = Object.entries(counts)
        .map(([roomId, count]) => ({ roomId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    res.json(sorted)
})

// Booking trend last 14 days
router.get('/trend', authenticate, requireRole('manager'), (req, res) => {
    const bookings = readJSON('bookings.json')
    const trend    = []
    for (let i = 13; i >= 0; i--) {
        const d     = new Date()
        d.setDate(d.getDate() - i)
        const date  = d.toLocaleDateString('en-CA')
        const count = bookings.filter(b => b.createdAt && b.createdAt.startsWith(date)).length
        trend.push({ date: date.slice(5), count })
    }
    res.json(trend)
})

// Revenue by floor
router.get('/revenue-by-floor', authenticate, requireRole('manager'), (req, res) => {
    const bookings = readJSON('bookings.json')
    const floors   = { 1: 0, 2: 0, 3: 0, 4: 0 }
    bookings.forEach(b => {
        if (b.floor && floors[b.floor] !== undefined)
            floors[b.floor] += b.total || 0
    })
    const result = Object.entries(floors).map(([floor, revenue]) => ({
        floor: 'F' + floor, revenue
    }))
    res.json(result)
})

// Booking mix by room type
router.get('/booking-mix', authenticate, requireRole('manager'), (req, res) => {
    const bookings = readJSON('bookings.json')
    const mix      = {}
    bookings.forEach(b => { mix[b.roomType] = (mix[b.roomType] || 0) + 1 })
    const result = Object.entries(mix).map(([type, count]) => ({ type, count }))
    res.json(result)
})

// Staff assignments
router.get('/staff', authenticate, requireRole('manager'), (req, res) => {
    const shifts   = readJSON('shifts.json')
    const checkins = readJSON('checkins.json')
    const users    = readJSON('users.json')

    const staffUsers = users.filter(u => u.role === 'staff')
    const today      = new Date().toLocaleDateString('en-CA')

    const result = staffUsers.map(u => {
        const todayShift    = shifts.find(s => s.staffId === u.id && s.date === today)
        const attending     = checkins.filter(c => c.handledBy === u.id && c.status === 'checked-in')
        const completed     = checkins.filter(c => c.handledBy === u.id && c.status !== 'checked-in')
        const totalHandled  = checkins.filter(c => c.handledBy === u.id)

        return {
            id:       u.id,
            name:     u.name,
            email:    u.email,
            shift:    todayShift ? `${todayShift.shiftType} (${todayShift.shiftStart} — ${todayShift.shiftEnd})` : 'No shift today',
            attending: attending.map(c => `${c.guestName} · Room ${c.roomId}`),
            completed: completed.length,
            total:     totalHandled.length
        }
    })
    res.json(result)
})

// Recent reviews
router.get('/reviews', authenticate, requireRole('manager'), (req, res) => {
    const reviews = readJSON('reviews.json')
    res.json(reviews.slice(-6).reverse())
})

module.exports = router