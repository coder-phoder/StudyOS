const express = require('express');
const { getCodingSessions, createCodingSession, deleteCodingSession } = require('../controllers/codingSession.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);
router.route('/')
    .get(getCodingSessions)
    .post(createCodingSession);
router.delete('/:sessionId', deleteCodingSession);

module.exports = router;
