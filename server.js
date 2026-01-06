const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://client-1zry3usc9-ramiru-nonis-projects.vercel.app',
        'https://client-lime-sigma-95.vercel.app',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static folder for uploads
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
const cvDir = path.join(uploadDir, 'cv');
const profileDir = path.join(uploadDir, 'profile');
const marksheetDir = path.join(uploadDir, 'marksheet');
const presentationDir = path.join(uploadDir, 'presentation');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(cvDir)) fs.mkdirSync(cvDir);
if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir);
if (!fs.existsSync(marksheetDir)) fs.mkdirSync(marksheetDir);
if (!fs.existsSync(presentationDir)) fs.mkdirSync(presentationDir);

app.use('/uploads', express.static(uploadDir, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.pdf')) {
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline');
        }
    }
}));
app.use('/api/uploads', express.static(uploadDir, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.pdf')) {
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline');
        }
    }
})); // Also serve at /api/uploads for consistency

const authRoutes = require('./routes/authRoutes');
const internshipRoutes = require('./routes/internshipRoutes');
const studentRoutes = require('./routes/studentRoutes');
const coordinatorRoutes = require('./routes/coordinatorRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const placementRoutes = require('./routes/placementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const logbookRoutes = require('./routes/logbookRoutes');
const submissionRoutes = require('./routes/submissionRoutes');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/internships', internshipRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/placement', placementRoutes);
app.use('/api/placement', placementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/logbooks', logbookRoutes);
app.use('/api/submissions', submissionRoutes);

app.get('/api/debug-smtp', async (req, res) => {
    try {
        const nodemailer = require('nodemailer');
        const user = process.env.EMAIL_USERNAME;
        const pass = process.env.EMAIL_PASSWORD;

        let status = {
            env_user_exists: !!user,
            env_pass_exists: !!pass,
            user_preview: user ? user.substring(0, 3) + '***' : 'MISSING',
            connection: 'PENDING'
        };

        if (!user || !pass) {
            return res.json({ ...status, error: 'Missing Variables' });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
        });

        await transporter.verify();
        status.connection = 'SUCCESS';
        res.json(status);
    } catch (error) {
        res.json({
            connection: 'FAILED',
            error: error.message,
            stack: error.stack
        });
    }
});

app.use('/api/logbooks', require('./routes/logbookRoutes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));

app.get('/', (req, res) => {
    res.send('API is running...');
});

// Initialize Scheduler
const initScheduler = require('./utils/scheduler');
initScheduler();

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
// Force Redeploy Trigger v1
