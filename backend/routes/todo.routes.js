const express = require('express');
const { getTodos, createTodo, updateTodo, reorderTodos, deleteTodo } = require('../controllers/todo.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);
router.route('/')
    .get(getTodos)
    .post(createTodo);
router.put('/reorder', reorderTodos);
router.route('/:todoId')
    .put(updateTodo)
    .delete(deleteTodo);

module.exports = router;
