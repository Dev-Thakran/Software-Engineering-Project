const roomRepo = require('../repositories/room.repository')

function getAll(req, res) {
  const { floor, type, status } = req.query
  let rooms = roomRepo.getAll()
  if (floor)  rooms = rooms.filter(r => r.floor  == floor)
  if (type)   rooms = rooms.filter(r => r.type   === type)
  if (status) rooms = rooms.filter(r => r.status === status)
  res.json(rooms)
}

function getOne(req, res) {
  const room = roomRepo.findById(req.params.id)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json(room)
}

function addRoom(req, res) {
  const { id, floor, type, price, description } = req.body
  if (!id || !floor || !type || !price)
    return res.status(400).json({ error: 'id, floor, type, and price are required' })
  const room = { id, floor: Number(floor), type, price: Number(price), status: 'available', description: description || '', image: '' }
  res.status(201).json(roomRepo.add(room))
}

function updateRoom(req, res) {
  const updated = roomRepo.update(req.params.id, req.body)
  if (!updated) return res.status(404).json({ error: 'Room not found' })
  res.json(updated)
}

function deleteRoom(req, res) {
  roomRepo.remove(req.params.id)
  res.json({ message: 'Room deleted' })
}

module.exports = { getAll, getOne, addRoom, updateRoom, deleteRoom }