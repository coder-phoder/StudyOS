const express = require('express');
const { getCalendarEvents, createCalendarEvents, deleteCalendarEvent } = require('../controllers/calendar.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);
router.route('/events')
    .get(getCalendarEvents)
    .post(createCalendarEvents);
router.delete('/events/:eventId', deleteCalendarEvent);

module.exports = router;
