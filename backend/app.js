const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;
const cors = require('cors');
const cookieParser = require('cookie-parser');
const userRoutes = require('./routes/user.routes');
const noteRoutes = require('./routes/note.routes');
const semesterRoutes = require('./routes/semester.routes');
const calendarRoutes = require('./routes/calendar.routes');
const todoRoutes = require('./routes/todo.routes');
const codingSessionRoutes = require('./routes/codingSession.routes');
const goalRoutes = require('./routes/goal.routes');

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CONNECTION TO DATABASE
const connectToDb = require('./db/db');
connectToDb();

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'StudyOS API is running',
        data: {},
    });
});

app.use('/api/users', userRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/coding-sessions', codingSessionRoutes);
app.use('/api/goals', goalRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
