const express = require('express');
const { chat } = require('../controllers/meridian.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/chat', protect, chat);

module.exports = router;
