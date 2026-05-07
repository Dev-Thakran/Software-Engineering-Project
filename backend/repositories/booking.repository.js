const fs   = require('fs')
const path = require('path')
const FILE = path.join(__dirname, '../data/bookings.json')

function getAll()         { return JSON.parse(fs.readFileSync(FILE, 'utf8')) }
function findById(id)     { return getAll().find(b => b.id === id) }
function findByUser(uid)  { return getAll().filter(b => b.userId === uid) }

function save(booking) {
  const bookings = getAll()
  bookings.push(booking)
  fs.writeFileSync(FILE, JSON.stringify(bookings, null, 2))
  return booking
}

function update(id, changes) {
  const bookings = getAll()
  const idx      = bookings.findIndex(b => b.id === id)
  if (idx === -1) return null
  bookings[idx] = { ...bookings[idx], ...changes }
  fs.writeFileSync(FILE, JSON.stringify(bookings, null, 2))
  return bookings[idx]
}

module.exports = { getAll, findById, findByUser, save, update }