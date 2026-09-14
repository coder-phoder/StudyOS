const express = require('express');
const {
    getSemesters,
    createSemester,
    updateSemester,
    deleteSemester,
    createSubject,
    updateSubject,
    deleteSubject,
    createTopic,
    updateTopic,
    deleteTopic,
} = require('../controllers/semester.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getSemesters)
    .post(createSemester);

router.route('/:semesterId')
    .put(updateSemester)
    .delete(deleteSemester);

router.post('/:semesterId/subjects', createSubject);
router.route('/:semesterId/subjects/:subjectId')
    .put(updateSubject)
    .delete(deleteSubject);

router.post('/:semesterId/subjects/:subjectId/topics', createTopic);
router.route('/:semesterId/subjects/:subjectId/topics/:topicId')
    .put(updateTopic)
    .delete(deleteTopic);

module.exports = router;
