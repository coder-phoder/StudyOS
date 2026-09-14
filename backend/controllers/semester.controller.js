const mongoose = require('mongoose');
const Semester = require('../models/semester.model');

const DEFAULT_COLOR = '#a78bfa';

const requestError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const formatSemester = (semester) => {
    const item = semester.toObject ? semester.toObject() : semester;
    const { owner, ...semesterData } = item;
    return semesterData;
};

const normalizeName = (value, label) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw requestError(`${label} is required`);
    }

    return value.trim();
};

const normalizeColor = (value) => {
    if (value === undefined) return DEFAULT_COLOR;
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
        throw requestError('Semester color must be a six-digit hex color');
    }

    return value.trim().toLowerCase();
};

const normalizeOptionalNumber = (value, label, minimum, maximum) => {
    if (value === undefined || value === null || value === '') return null;

    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
        throw requestError(`${label} must be between ${minimum} and ${maximum}`);
    }

    return number;
};

const normalizeDueDate = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw requestError('Due date must use the YYYY-MM-DD format');
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    const [year, month, day] = value.split('-').map(Number);
    if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
        throw requestError('Due date is invalid');
    }
    return date;
};

const findSemester = async (semesterId, ownerId) => {
    if (!mongoose.isValidObjectId(semesterId)) return null;
    return Semester.findOne({ _id: semesterId, owner: ownerId });
};

const semesterNotFound = (res) => res.status(404).json({
    success: false,
    message: 'Semester not found',
    data: {},
});

const handleControllerError = (res, error, fallbackMessage) => {
    if (error.statusCode || error.name === 'ValidationError') {
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || Object.values(error.errors)[0].message,
            data: {},
        });
    }

    return res.status(500).json({
        success: false,
        message: fallbackMessage,
        data: {},
    });
};

const getSemesters = async (req, res) => {
    try {
        const semesters = await Semester.find({ owner: req.user._id }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Semesters retrieved successfully',
            data: { semesters: semesters.map(formatSemester) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to retrieve semesters');
    }
};

const createSemester = async (req, res) => {
    try {
        const semester = await Semester.create({
            owner: req.user._id,
            name: normalizeName(req.body.name, 'Semester name'),
            color: normalizeColor(req.body.color),
        });

        return res.status(201).json({
            success: true,
            message: 'Semester created successfully',
            data: { semester: formatSemester(semester) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to create semester');
    }
};

const updateSemester = async (req, res) => {
    try {
        const semester = await findSemester(req.params.semesterId, req.user._id);
        if (!semester) return semesterNotFound(res);

        if (req.body.name !== undefined) semester.name = normalizeName(req.body.name, 'Semester name');
        if (req.body.color !== undefined) semester.color = normalizeColor(req.body.color);
        if (req.body.name === undefined && req.body.color === undefined) throw requestError('Provide a semester name or color to update');

        await semester.save();
        return res.status(200).json({
            success: true,
            message: 'Semester updated successfully',
            data: { semester: formatSemester(semester) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to update semester');
    }
};

const deleteSemester = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.semesterId)) return semesterNotFound(res);
        const semester = await Semester.findOneAndDelete({ _id: req.params.semesterId, owner: req.user._id });
        if (!semester) return semesterNotFound(res);

        return res.status(200).json({
            success: true,
            message: 'Semester deleted successfully',
            data: {},
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to delete semester');
    }
};

const createSubject = async (req, res) => {
    try {
        const semester = await findSemester(req.params.semesterId, req.user._id);
        if (!semester) return semesterNotFound(res);

        semester.subjects.push({ name: normalizeName(req.body.name, 'Subject name') });
        await semester.save();

        return res.status(201).json({
            success: true,
            message: 'Subject created successfully',
            data: { semester: formatSemester(semester) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to create subject');
    }
};

const updateSubject = async (req, res) => {
    try {
        const semester = await findSemester(req.params.semesterId, req.user._id);
        if (!semester) return semesterNotFound(res);

        const subject = semester.subjects.id(req.params.subjectId);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found', data: {} });
        }

        if (req.body.name !== undefined) subject.name = normalizeName(req.body.name, 'Subject name');
        if (req.body.grade !== undefined) subject.grade = normalizeOptionalNumber(req.body.grade, 'Grade', 0, 100);
        if (req.body.credits !== undefined) subject.credits = normalizeOptionalNumber(req.body.credits, 'Credits', 0.5, 100);
        if (req.body.name === undefined && req.body.grade === undefined && req.body.credits === undefined) {
            throw requestError('Provide a subject field to update');
        }

        await semester.save();
        return res.status(200).json({
            success: true,
            message: 'Subject updated successfully',
            data: { semester: formatSemester(semester) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to update subject');
    }
};

const deleteSubject = async (req, res) => {
    try {
        const semester = await findSemester(req.params.semesterId, req.user._id);
        if (!semester) return semesterNotFound(res);

        const subject = semester.subjects.id(req.params.subjectId);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found', data: {} });
        }

        subject.deleteOne();
        await semester.save();
        return res.status(200).json({
            success: true,
            message: 'Subject deleted successfully',
            data: { semester: formatSemester(semester) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to delete subject');
    }
};

const createTopic = async (req, res) => {
    try {
        const semester = await findSemester(req.params.semesterId, req.user._id);
        if (!semester) return semesterNotFound(res);

        const subject = semester.subjects.id(req.params.subjectId);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found', data: {} });
        }

        subject.topics.push({
            name: normalizeName(req.body.name, 'Topic name'),
            dueDate: normalizeDueDate(req.body.dueDate),
        });
        await semester.save();

        return res.status(201).json({
            success: true,
            message: 'Topic created successfully',
            data: { semester: formatSemester(semester) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to create topic');
    }
};

const updateTopic = async (req, res) => {
    try {
        const semester = await findSemester(req.params.semesterId, req.user._id);
        if (!semester) return semesterNotFound(res);

        const subject = semester.subjects.id(req.params.subjectId);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found', data: {} });
        }

        const topic = subject.topics.id(req.params.topicId);
        if (!topic) {
            return res.status(404).json({ success: false, message: 'Topic not found', data: {} });
        }

        if (req.body.name !== undefined) topic.name = normalizeName(req.body.name, 'Topic name');
        if (req.body.completed !== undefined) {
            if (typeof req.body.completed !== 'boolean') throw requestError('Topic completion must be true or false');
            topic.completed = req.body.completed;
        }
        if (req.body.dueDate !== undefined) topic.dueDate = normalizeDueDate(req.body.dueDate);
        if (req.body.name === undefined && req.body.completed === undefined && req.body.dueDate === undefined) {
            throw requestError('Provide a topic field to update');
        }

        await semester.save();
        return res.status(200).json({
            success: true,
            message: 'Topic updated successfully',
            data: { semester: formatSemester(semester) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to update topic');
    }
};

const deleteTopic = async (req, res) => {
    try {
        const semester = await findSemester(req.params.semesterId, req.user._id);
        if (!semester) return semesterNotFound(res);

        const subject = semester.subjects.id(req.params.subjectId);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found', data: {} });
        }

        const topic = subject.topics.id(req.params.topicId);
        if (!topic) {
            return res.status(404).json({ success: false, message: 'Topic not found', data: {} });
        }

        topic.deleteOne();
        await semester.save();
        return res.status(200).json({
            success: true,
            message: 'Topic deleted successfully',
            data: { semester: formatSemester(semester) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to delete topic');
    }
};

module.exports = {
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
};
