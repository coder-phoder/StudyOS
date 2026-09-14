const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

const createToken = (userId) => {
    if (!process.env.JWT_SECRET) {
        const error = new Error('Server authentication is not configured');
        error.statusCode = 500;
        throw error;
    }

    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

const formatUser = (user) => {
    const userData = user.toObject();
    delete userData.password;
    return userData;
};

const register = async (req, res) => {
    try {
        const { username, phone, email, password, dob, gender, avatar, bio } = req.body;
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';

        if (!username?.trim() || !normalizedPhone || !normalizedEmail || !password || !dob || !gender) {
            return res.status(400).json({
                success: false,
                message: 'Username, phone, email, password, date of birth, and gender are required',
                data: {},
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters',
                data: {},
            });
        }

        const existingUser = await User.findOne({
            $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
        });

        if (existingUser) {
            const duplicateField = existingUser.email === normalizedEmail ? 'email' : 'phone number';
            return res.status(409).json({
                success: false,
                message: `A user with this ${duplicateField} already exists`,
                data: {},
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await User.create({
            username: username.trim(),
            phone: normalizedPhone,
            email: normalizedEmail,
            password: hashedPassword,
            dob,
            gender,
            avatar,
            bio,
        });
        const token = createToken(user._id.toString());

        return res.status(201).cookie('token', token, cookieOptions).json({
            success: true,
            message: 'User registered successfully',
            data: { user: formatUser(user) },
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: Object.values(error.errors)[0].message,
                data: {},
            });
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'A user with this email or phone number already exists',
                data: {},
            });
        }

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : 'Unable to register user',
            data: {},
        });
    }
};

const login = async (req, res) => {
    try {
        const { password } = req.body;
        const identifier = String(req.body.identifier || req.body.email || req.body.phone || '').trim();

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email or phone number and password are required',
                data: {},
            });
        }

        const user = await User.findOne({
            $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
        }).select('+password');

        if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
                data: {},
            });
        }

        const token = createToken(user._id.toString());

        return res.cookie('token', token, cookieOptions).status(200).json({
            success: true,
            message: 'User logged in successfully',
            data: { user: formatUser(user) },
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : 'Unable to log in',
            data: {},
        });
    }
};

const logout = async (req, res) => {
    try {
        return res.clearCookie('token', cookieOptions).status(200).json({
            success: true,
            message: 'User logged out successfully',
            data: {},
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Unable to log out',
            data: {},
        });
    }
};

const getProfile = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: 'User profile retrieved successfully',
            data: { user: formatUser(req.user) },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve user profile',
            data: {},
        });
    }
};

module.exports = { register, login, logout, getProfile };
