const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');

router.get('/profile/:id', driverController.getPublicProfile);

module.exports = router;

