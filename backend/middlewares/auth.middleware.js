const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const protect = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization;
        const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
        const token = req.cookies.token || bearerToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                data: {},
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'Server authentication is not configured',
                data: {},
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'User account is unavailable',
                data: {},
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired authentication token',
            data: {},
        });
    }
};

module.exports = { protect };
