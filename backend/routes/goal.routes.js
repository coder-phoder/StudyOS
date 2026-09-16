const express = require('express');
const { getGoals, createGoal, updateGoal, deleteGoal } = require('../controllers/goal.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);
router.route('/')
    .get(getGoals)
    .post(createGoal);
router.route('/:goalId')
    .put(updateGoal)
    .delete(deleteGoal);

module.exports = router;
