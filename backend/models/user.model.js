const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Username is required'],
            trim: true,
            minlength: [3, 'Username must be at least 3 characters'],
            maxlength: [50, 'Username cannot exceed 50 characters'],
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            unique: true,
            trim: true,
            match: [/^\+?[1-9]\d{7,14}$/, 'Please provide a valid phone number'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters'],
            select: false,
        },
        dob: {
            type: Date,
            required: [true, 'Date of birth is required'],
            validate: {
                validator: (value) => value < new Date(),
                message: 'Date of birth must be in the past',
            },
        },
        gender: {
            type: String,
            required: [true, 'Gender is required'],
            enum: {
                values: ['male', 'female', 'non-binary', 'prefer-not-to-say'],
                message: 'Please provide a valid gender',
            },
        },
        avatar: {
            type: String,
            trim: true,
            default: '',
        },
        bio: {
            type: String,
            trim: true,
            maxlength: [500, 'Bio cannot exceed 500 characters'],
            default: '',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
