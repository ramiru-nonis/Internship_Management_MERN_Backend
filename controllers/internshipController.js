const Internship = require('../models/Internship');
const Application = require('../models/Application');
const Student = require('../models/Student');

// @desc    Get all internships
// @route   GET /api/internships
// @access  Private
const getInternships = async (req, res) => {
    try {
        // Auto-expire jobs
        const currentDate = new Date();
        await Internship.updateMany(
            {
                deadline: { $lt: currentDate },
                status: 'active'
            },
            { status: 'expired' }
        );

        const { category, search, status } = req.query;

        let query = {};

        // Filter by category
        if (category && category !== 'all') {
            query.category = category;
        }

        // Filter by status (default to active)
        query.status = status || 'active';

        // Search by title, company, or description
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { company_name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const internships = await Internship.find(query)
            .populate('posted_by', 'email role')
            .sort({ createdAt: -1 })
            .lean();

        // Add application count to each internship
        const internshipsWithCount = await Promise.all(
            internships.map(async (internship) => {
                const applicationCount = await Application.countDocuments({ internship: internship._id });
                return { ...internship, applicationCount };
            })
        );

        res.json(internshipsWithCount);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single internship
// @route   GET /api/internships/:id
// @access  Private
const getInternshipById = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id).populate('posted_by', 'email role');

        if (!internship) {
            return res.status(404).json({ message: 'Internship not found' });
        }

        let hasApplied = false;

        // Check if current user is a student and has applied
        if (req.user && req.user.role === 'student') {
            const student = await Student.findOne({ user: req.user._id });
            if (student) {
                const application = await Application.findOne({
                    internship: internship._id,
                    student: student._id
                });
                if (application) {
                    hasApplied = true;
                }
            }
        }

        res.json({ ...internship.toObject(), hasApplied });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create an internship
// @route   POST /api/internships
// @access  Private (Coordinator/Admin)
const createInternship = async (req, res) => {
    const { title, company_name, description, requirements, deadline, category, skills, location, type, stipend, duration, employer_email } = req.body;

    try {
        const internship = new Internship({
            title,
            company_name,
            description,
            requirements,
            deadline,
            category,
            skills: Array.isArray(skills) ? skills : JSON.parse(skills || '[]'),
            location,
            type,
            stipend,
            duration,
            employer_email,
            posted_by: req.user._id,
        });

        const createdInternship = await internship.save();
        res.status(201).json(createdInternship);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Apply for an internship
// @route   POST /api/internships/:id/apply
// @access  Private (Student)
const applyForInternship = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            res.status(404).json({ message: 'Student profile not found' });
            return;
        }

        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            res.status(404).json({ message: 'Internship not found' });
            return;
        }

        // Check if already applied
        const existingApplication = await Application.findOne({
            internship: internship._id,
            student: student._id,
        });

        if (existingApplication) {
            res.status(400).json({ message: 'You have already applied for this internship' });
            return;
        }

        const application = new Application({
            internship: internship._id,
            student: student._id,
        });

        const { createNotification } = require('./notificationController');

        // ... (inside applyForInternship)

        const createdApplication = await application.save();

        // Notify Coordinator
        await createNotification(
            internship.posted_by,
            `New application for ${internship.title} from ${student.first_name} ${student.last_name}`,
            'info',
            createdApplication._id,
            'Application'
        );

        res.status(201).json(createdApplication);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update an internship
// @route   PUT /api/internships/:id
// @access  Private (Coordinator/Admin)
const updateInternship = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);

        if (!internship) {
            return res.status(404).json({ message: 'Internship not found' });
        }

        const { title, company_name, description, requirements, deadline, category, skills, location, status, type, stipend, duration, employer_email } = req.body;

        if (title) internship.title = title;
        if (company_name) internship.company_name = company_name;
        if (description) internship.description = description;
        if (requirements) internship.requirements = requirements;
        if (deadline) internship.deadline = deadline;
        if (category) internship.category = category;
        if (skills) internship.skills = Array.isArray(skills) ? skills : JSON.parse(skills);
        if (location) internship.location = location;
        if (status) internship.status = status;
        if (type) internship.type = type;
        if (stipend) internship.stipend = stipend;
        if (duration) internship.duration = duration;
        if (employer_email) internship.employer_email = employer_email;

        const updatedInternship = await internship.save();
        res.json(updatedInternship);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get expired internships
// @route   GET /api/internships/history
// @access  Private (Coordinator/Admin)
const getExpiredInternships = async (req, res) => {
    try {
        const expiredInternships = await Internship.find({ status: 'expired' })
            .populate('posted_by', 'email role')
            .sort({ deadline: -1 })
            .lean();

        // Add application count to each internship
        const internshipsWithCount = await Promise.all(
            expiredInternships.map(async (internship) => {
                const applicationCount = await Application.countDocuments({ internship: internship._id });
                return { ...internship, applicationCount };
            })
        );

        res.json(internshipsWithCount);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete an internship
// @route   DELETE /api/internships/:id
// @access  Private (Coordinator/Admin)
const deleteInternship = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);

        if (!internship) {
            return res.status(404).json({ message: 'Internship not found' });
        }

        await internship.deleteOne();
        res.json({ message: 'Internship removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getInternships,
    getInternshipById,
    createInternship,
    applyForInternship,
    updateInternship,
    getExpiredInternships,
    deleteInternship,
};
