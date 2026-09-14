const express = require('express');
const { getNotes, getNote, createNote, updateNote, deleteNote } = require('../controllers/note.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);
router.route('/')
    .get(getNotes)
    .post(createNote);
router.route('/:noteId')
    .get(getNote)
    .put(updateNote)
    .delete(deleteNote);

module.exports = router;
