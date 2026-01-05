const PlacementForm = require('../models/PlacementForm');
const Student = require('../models/Student');

// @desc    Submit placement form
// @route   POST /api/placement
// @access  Private (Student)
const submitPlacementForm = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        // Check if already submitted
        const existingForm = await PlacementForm.findOne({ student: student._id });

        if (existingForm) {
            // If student is already hired/approved/intern, prevent resubmission
            if (['hired', 'approved', 'intern'].includes(student.status)) {
                return res.status(400).json({ message: 'Placement form already submitted' });
            }
            // If status is 'not hired' or 'non-intern', allow resubmission (delete old form)
            await PlacementForm.findByIdAndDelete(existingForm._id);
        }

        const {
            full_name,
            student_id_number,
            batch_code,
            email,
            address,
            has_visa,
            award_title,
            emergency_contact,
            emergency_relationship,
            company_name,
            company_address,
            company_phone,
            company_email,
            position,
            placement_job_title,
            placement_job_role,
            start_date,
            end_date,

            mentor_name,
            mentor_email,
            mentor_phone,
            description,
        } = req.body;

        const placementForm = new PlacementForm({
            student: student._id,
            full_name,
            student_id_number,
            batch_code,
            email,
            address,
            has_visa,
            award_title,
            emergency_contact,
            emergency_relationship,
            company_name,
            company_address,
            company_phone,
            company_email,
            position,
            placement_job_title,
            placement_job_role,
            start_date,
            end_date,

            mentor_name,
            mentor_email,
            mentor_phone,
            description,
        });

        await placementForm.save();

        // Update student status to 'intern'
        student.status = 'intern';
        await student.save();

        res.status(201).json({
            message: 'Placement form submitted successfully',
            placementForm,
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get student's placement form
// @route   GET /api/placement
// @access  Private (Student)
const getPlacementForm = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        // If student status is 'not hired' or 'non-intern', pretend no form exists to allow resubmission
        if (['not hired', 'non-intern'].includes(student.status)) {
            return res.status(200).json(null);
        }

        const placementForm = await PlacementForm.findOne({ student: student._id });

        if (!placementForm) {
            return res.status(200).json(null);
        }

        res.json(placementForm);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all placement forms
// @route   GET /api/placement/all
// @access  Private (Coordinator/Admin)
const getAllPlacementForms = async (req, res) => {
    try {
        const placementForms = await PlacementForm.find()
            .populate({
                path: 'student',
                select: 'first_name last_name cb_number contact_number',
                populate: {
                    path: 'user',
                    select: 'email'
                }
            })
            .sort({ createdAt: -1 });

        res.json(placementForms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    submitPlacementForm,
    getPlacementForm,
    getAllPlacementForms,
};
