const express = require('express')
const { processPayment } = require('../controllers/payment.controller')
const { authenticate } = require('../middleware/auth.middleware')
const router = express.Router()

router.post('/process', authenticate, processPayment)

module.exports = router