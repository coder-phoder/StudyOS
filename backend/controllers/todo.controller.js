const mongoose = require('mongoose');
const Todo = require('../models/todo.model');

const requestError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const formatTodo = (todo) => {
    const item = todo.toObject ? todo.toObject() : todo;
    const { owner, ...todoData } = item;
    return todoData;
};

const normalizeText = (value) => {
    if (typeof value !== 'string' || !value.trim()) throw requestError('Task text is required');
    return value.trim();
};

const normalizePriority = (value) => {
    if (!['high', 'medium', 'low'].includes(value)) throw requestError('Priority must be high, medium, or low');
    return value;
};

const normalizeRecurrence = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (!['daily', 'weekly', 'monthly'].includes(value)) {
        throw requestError('Recurrence must be daily, weekly, monthly, or empty');
    }
    return value;
};

const startOfWeek = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date.getTime();
};

const needsRecurrenceReset = (todo, now) => {
    if (!todo.recurrence || !todo.completed || !todo.lastCompleted) return false;
    const lastCompleted = new Date(todo.lastCompleted);
    if (todo.recurrence === 'daily') return now.toDateString() !== lastCompleted.toDateString();
    if (todo.recurrence === 'weekly') return startOfWeek(now) > startOfWeek(lastCompleted);
    return now.getFullYear() !== lastCompleted.getFullYear() || now.getMonth() !== lastCompleted.getMonth();
};

const resetRecurringTodos = async (ownerId) => {
    const candidates = await Todo.find({ owner: ownerId, completed: true, recurrence: { $ne: null }, lastCompleted: { $ne: null } });
    const now = new Date();
    const dueForReset = candidates.filter((todo) => needsRecurrenceReset(todo, now));
    if (dueForReset.length) {
        await Todo.bulkWrite(dueForReset.map((todo) => ({
            updateOne: { filter: { _id: todo._id, owner: ownerId }, update: { $set: { completed: false } } },
        })));
    }
};

const getOrderedTodos = async (ownerId) => Todo.find({ owner: ownerId }).sort({ completed: 1, order: 1, createdAt: 1 });

const findUserTodo = async (todoId, ownerId) => {
    if (!mongoose.isValidObjectId(todoId)) return null;
    return Todo.findOne({ _id: todoId, owner: ownerId });
};

const handleControllerError = (res, error, fallbackMessage) => res.status(error.statusCode || (error.name === 'ValidationError' ? 400 : 500)).json({
    success: false,
    message: error.statusCode || error.name === 'ValidationError' ? error.message : fallbackMessage,
    data: {},
});

const getTodos = async (req, res) => {
    try {
        await resetRecurringTodos(req.user._id);
        const todos = await getOrderedTodos(req.user._id);
        return res.status(200).json({
            success: true,
            message: 'To-do list retrieved successfully',
            data: { todos: todos.map(formatTodo) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to retrieve to-do list');
    }
};

const createTodo = async (req, res) => {
    try {
        const latestTodo = await Todo.findOne({ owner: req.user._id }).sort({ order: -1 }).select('order');
        const todo = await Todo.create({
            owner: req.user._id,
            text: normalizeText(req.body.text),
            priority: req.body.priority === undefined ? 'medium' : normalizePriority(req.body.priority),
            recurrence: normalizeRecurrence(req.body.recurrence),
            order: (latestTodo?.order || 0) + 1,
        });

        return res.status(201).json({
            success: true,
            message: 'To-do created successfully',
            data: { todo: formatTodo(todo) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to create to-do');
    }
};

const updateTodo = async (req, res) => {
    try {
        const todo = await findUserTodo(req.params.todoId, req.user._id);
        if (!todo) return res.status(404).json({ success: false, message: 'To-do not found', data: {} });

        const hasUpdate = ['text', 'priority', 'recurrence', 'completed'].some((field) => req.body[field] !== undefined);
        if (!hasUpdate) throw requestError('Provide a to-do field to update');

        if (req.body.text !== undefined) todo.text = normalizeText(req.body.text);
        if (req.body.priority !== undefined) todo.priority = normalizePriority(req.body.priority);
        if (req.body.recurrence !== undefined) todo.recurrence = normalizeRecurrence(req.body.recurrence);
        if (req.body.completed !== undefined) {
            if (typeof req.body.completed !== 'boolean') throw requestError('Completion must be true or false');
            todo.completed = req.body.completed;
            todo.lastCompleted = req.body.completed ? new Date() : null;
        }

        await todo.save();
        return res.status(200).json({
            success: true,
            message: 'To-do updated successfully',
            data: { todo: formatTodo(todo) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to update to-do');
    }
};

const reorderTodos = async (req, res) => {
    try {
        const orderedIds = req.body.orderedIds;
        if (!Array.isArray(orderedIds) || new Set(orderedIds).size !== orderedIds.length || !orderedIds.every((id) => mongoose.isValidObjectId(id))) {
            throw requestError('A unique ordered list of to-do IDs is required');
        }

        const todos = await Todo.find({ owner: req.user._id }).select('_id');
        const existingIds = todos.map((todo) => todo._id.toString());
        if (existingIds.length !== orderedIds.length || existingIds.some((id) => !orderedIds.includes(id))) {
            throw requestError('The ordered to-do list does not match your saved tasks');
        }

        if (orderedIds.length) {
            await Todo.bulkWrite(orderedIds.map((id, index) => ({
                updateOne: { filter: { _id: id, owner: req.user._id }, update: { $set: { order: index + 1 } } },
            })));
        }
        const updatedTodos = await getOrderedTodos(req.user._id);
        return res.status(200).json({
            success: true,
            message: 'To-do order updated successfully',
            data: { todos: updatedTodos.map(formatTodo) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to reorder to-dos');
    }
};

const deleteTodo = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.todoId)) {
            return res.status(404).json({ success: false, message: 'To-do not found', data: {} });
        }
        const todo = await Todo.findOneAndDelete({ _id: req.params.todoId, owner: req.user._id });
        if (!todo) return res.status(404).json({ success: false, message: 'To-do not found', data: {} });

        return res.status(200).json({
            success: true,
            message: 'To-do deleted successfully',
            data: {},
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to delete to-do');
    }
};

module.exports = { getTodos, createTodo, updateTodo, reorderTodos, deleteTodo };
