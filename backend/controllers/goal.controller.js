const mongoose = require('mongoose');
const Goal = require('../models/goal.model');

const requestError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const formatGoal = (goal) => {
    const item = goal.toObject ? goal.toObject() : goal;
    const { owner, ...goalData } = item;
    return goalData;
};

const normalizeText = (value) => {
    if (typeof value !== 'string' || !value.trim()) throw requestError('Goal text is required');
    if (value.trim().length > 300) throw requestError('Goal text cannot exceed 300 characters');
    return value.trim();
};

const normalizeCgpa = (value, label) => {
    if (value === undefined || value === null || value === '') return null;
    const cgpa = Number(value);
    if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) {
        throw requestError(`${label} must be between 0 and 10`);
    }
    return cgpa;
};

const normalizeTargetDate = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw requestError('Target date must be a valid date');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw requestError('Target date must be a valid date');
    return date;
};

const handleControllerError = (res, error, fallbackMessage) => res.status(error.statusCode || (error.name === 'ValidationError' ? 400 : 500)).json({
    success: false,
    message: error.statusCode || error.name === 'ValidationError' ? error.message : fallbackMessage,
    data: {},
});

const getGoals = async (req, res) => {
    try {
        const goals = await Goal.find({ owner: req.user._id }).sort({ completed: 1, createdAt: -1 });
        return res.status(200).json({
            success: true,
            message: 'Goals retrieved successfully',
            data: { goals: goals.map(formatGoal) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to retrieve goals');
    }
};

const createGoal = async (req, res) => {
    try {
        const goal = await Goal.create({
            owner: req.user._id,
            text: normalizeText(req.body.text),
            targetCgpa: normalizeCgpa(req.body.targetCgpa, 'Target CGPA'),
            currentCgpa: normalizeCgpa(req.body.currentCgpa, 'Current CGPA'),
            targetDate: normalizeTargetDate(req.body.targetDate),
        });
        return res.status(201).json({
            success: true,
            message: 'Goal created successfully',
            data: { goal: formatGoal(goal) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to create goal');
    }
};

const updateGoal = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.goalId)) {
            return res.status(404).json({ success: false, message: 'Goal not found', data: {} });
        }

        const goal = await Goal.findOne({ _id: req.params.goalId, owner: req.user._id });
        if (!goal) return res.status(404).json({ success: false, message: 'Goal not found', data: {} });

        const fields = ['text', 'targetCgpa', 'currentCgpa', 'targetDate', 'completed'];
        if (!fields.some((field) => req.body[field] !== undefined)) throw requestError('Provide a goal field to update');

        if (req.body.text !== undefined) goal.text = normalizeText(req.body.text);
        if (req.body.targetCgpa !== undefined) goal.targetCgpa = normalizeCgpa(req.body.targetCgpa, 'Target CGPA');
        if (req.body.currentCgpa !== undefined) goal.currentCgpa = normalizeCgpa(req.body.currentCgpa, 'Current CGPA');
        if (req.body.targetDate !== undefined) goal.targetDate = normalizeTargetDate(req.body.targetDate);
        if (req.body.completed !== undefined) {
            if (typeof req.body.completed !== 'boolean') throw requestError('Completion must be true or false');
            goal.completed = req.body.completed;
        }

        await goal.save();
        return res.status(200).json({
            success: true,
            message: 'Goal updated successfully',
            data: { goal: formatGoal(goal) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to update goal');
    }
};

const deleteGoal = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.goalId)) {
            return res.status(404).json({ success: false, message: 'Goal not found', data: {} });
        }

        const goal = await Goal.findOneAndDelete({ _id: req.params.goalId, owner: req.user._id });
        if (!goal) return res.status(404).json({ success: false, message: 'Goal not found', data: {} });

        return res.status(200).json({
            success: true,
            message: 'Goal deleted successfully',
            data: {},
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to delete goal');
    }
};

module.exports = { getGoals, createGoal, updateGoal, deleteGoal };
