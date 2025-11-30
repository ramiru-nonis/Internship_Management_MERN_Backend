const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Student = require('./models/Student');
const Admin = require('./models/Admin');
const Coordinator = require('./models/Coordinator');
const Internship = require('./models/Internship');
const Application = require('./models/Application');
const PlacementForm = require('./models/PlacementForm');

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const importData = async () => {
    try {
        await connectDB();

        // Clear existing data
        await User.deleteMany();
        await Student.deleteMany();
        await Admin.deleteMany();
        await Coordinator.deleteMany();
        await Internship.deleteMany();
        await Application.deleteMany();
        await PlacementForm.deleteMany();

        console.log('Data Cleared!');

        const sqlContent = fs.readFileSync(path.join(__dirname, '../../nextstep (1).sql'), 'utf8');

        // Helper to extract values from INSERT statements
        const extractValues = (tableName) => {
            // Match until ; followed by newline or end of string
            const regex = new RegExp(`INSERT INTO \`${tableName}\` .*? VALUES\\s*([\\s\\S]*?);\\s*($|\\n)`, 'g');
            const matches = [];
            let match;
            while ((match = regex.exec(sqlContent)) !== null) {
                let valuesBlock = match[1];
                // State machine to parse values
                let inQuote = false;
                let currentVal = '';
                let currentRow = [];
                let inRow = false;

                for (let i = 0; i < valuesBlock.length; i++) {
                    const char = valuesBlock[i];
                    const prevChar = i > 0 ? valuesBlock[i - 1] : null;

                    if (!inRow) {
                        if (char === '(') {
                            inRow = true;
                            currentRow = [];
                            currentVal = '';
                        }
                        continue;
                    }

                    if (inQuote) {
                        if (char === "'" && prevChar !== '\\') {
                            inQuote = false;
                        }
                        currentVal += char;
                    } else {
                        if (char === "'" && prevChar !== '\\') {
                            inQuote = true;
                            currentVal += char;
                        } else if (char === ',') {
                            currentRow.push(currentVal.trim());
                            currentVal = '';
                        } else if (char === ')') {
                            currentRow.push(currentVal.trim());
                            matches.push(currentRow.map(val => {
                                if (val === 'NULL') return null;
                                if (val.startsWith("'") && val.endsWith("'")) {
                                    return val.slice(1, -1).replace(/\\'/g, "'").replace(/\\r\\n/g, '\n').replace(/\\"/g, '"');
                                }
                                return val;
                            }));
                            inRow = false;
                        } else {
                            currentVal += char;
                        }
                    }
                }
            }
            if (tableName === 'internships') {
                console.log(`Table ${tableName}: Found ${matches.length} rows.`);
                if (matches.length > 0) {
                    console.log('First row ID:', matches[0][0]);
                }
            }
            return matches;
        };

        // 1. Users
        const userRows = extractValues('users');
        const userMap = new Map(); // SQL ID -> Mongo ID
        const users = [];

        for (const row of userRows) {
            const [id, email, password, role, created_at] = row;
            const user = new User({
                email,
                password, // Already hashed
                role,
            });
            // Bypass pre-save hook that hashes password again if modified
            // We need to set isModified to false for password or handle it in model
            // Actually, the model hashes if isModified('password'). 
            // Since we are creating new, it IS modified.
            // We need to temporarily disable the hook or manually insert.
            // Let's use insertMany which bypasses save hooks? No, insertMany might trigger validation but not middleware depending on options.
            // Mongoose insertMany DOES NOT trigger pre('save') hooks.
            users.push(user);
            // We need to save mapping for foreign keys
        }

        // We insert users first to get their _ids
        const createdUsers = await User.insertMany(users);

        // Map SQL IDs to Mongo IDs
        userRows.forEach((row, index) => {
            userMap.set(row[0], createdUsers[index]._id);
        });
        console.log(`Imported ${createdUsers.length} Users`);

        // 2. Admins
        const adminRows = extractValues('admins');
        const admins = adminRows.map(row => {
            const [id, user_id, first_name, last_name, contact_number, created_at] = row;
            return {
                user: userMap.get(user_id),
                first_name,
                last_name,
                contact_number,
            };
        });
        await Admin.insertMany(admins);
        console.log(`Imported ${admins.length} Admins`);

        // 3. Coordinators
        const coordinatorRows = extractValues('coordinators');
        const coordinators = coordinatorRows.map(row => {
            const [id, user_id, first_name, last_name, contact_number, created_at] = row;
            return {
                user: userMap.get(user_id),
                first_name,
                last_name,
                contact_number,
            };
        });
        await Coordinator.insertMany(coordinators);
        console.log(`Imported ${coordinators.length} Coordinators`);

        // 4. Students
        const studentRows = extractValues('students');
        const studentMap = new Map(); // SQL ID -> Mongo ID
        const students = studentRows.map(row => {
            const [id, user_id, cb_number, first_name, last_name, contact_number, degree, degree_level, availability, cv, profile_picture, created_at] = row;
            return {
                user: userMap.get(user_id),
                cb_number,
                first_name,
                last_name,
                contact_number,
                degree,
                degree_level,
                availability,
                cv,
                profile_picture,
                // Preferences will be handled separately if needed, or we can fetch them now
            };
        });

        // Preferences
        const preferenceRows = extractValues('preferences');
        // Group preferences by student_id
        const preferencesByStudent = {};
        preferenceRows.forEach(row => {
            const [id, student_id, preference_name, created_at] = row;
            if (!preferencesByStudent[student_id]) preferencesByStudent[student_id] = [];
            preferencesByStudent[student_id].push(preference_name);
        });

        // Attach preferences to students
        const studentsWithPrefs = students.map((student, index) => {
            const sqlId = studentRows[index][0];
            if (preferencesByStudent[sqlId]) {
                student.preferences = preferencesByStudent[sqlId];
            }
            return student;
        });

        const createdStudents = await Student.insertMany(studentsWithPrefs);
        studentRows.forEach((row, index) => {
            studentMap.set(row[0], createdStudents[index]._id);
        });
        console.log(`Imported ${createdStudents.length} Students`);

        // 5. Internships
        const internshipRows = extractValues('internships');
        const internshipMap = new Map(); // SQL ID -> Mongo ID

        // Skills
        const skillRows = extractValues('skills');
        const skillMap = new Map(); // SQL ID -> Name
        skillRows.forEach(row => {
            skillMap.set(row[0], row[1]);
        });

        // Internship Skills
        const internshipSkillRows = extractValues('internship_skills');
        const skillsByInternship = {};
        internshipSkillRows.forEach(row => {
            const [internship_id, skill_id] = row;
            if (!skillsByInternship[internship_id]) skillsByInternship[internship_id] = [];
            skillsByInternship[internship_id].push(skillMap.get(skill_id));
        });

        // Find a coordinator to assign as 'posted_by' (required field)
        // In SQL there is no posted_by, so we'll pick the first coordinator or admin
        const defaultPoster = createdUsers.find(u => u.role === 'coordinator' || u.role === 'admin')?._id || createdUsers[0]._id;

        const internships = internshipRows.map(row => {
            const [id, title, company_name, company_logo, location, type, website, description, responsibilities, stipend, duration, employer_email, deadline, created_at] = row;
            return {
                title,
                company_name,
                company_logo,
                location,
                type,
                website,
                description,
                responsibilities,
                stipend,
                duration,
                employer_email,
                deadline: new Date(deadline),
                posted_by: defaultPoster,
                skills: skillsByInternship[id] || [],
                requirements: 'See description', // Default as it's required but not in SQL
                category: 'General', // Default
            };
        });

        const createdInternships = await Internship.insertMany(internships);
        internshipRows.forEach((row, index) => {
            internshipMap.set(row[0], createdInternships[index]._id);
        });
        console.log(`Imported ${createdInternships.length} Internships`);

        // 6. Applications
        const applicationRows = extractValues('applications');
        const applications = applicationRows.map(row => {
            const [id, student_id, internship_id, apply_type, cv, applied_at] = row;
            return {
                student: studentMap.get(student_id),
                internship: internshipMap.get(internship_id),
                apply_type,
                cv,
                status: 'Applied', // Default
            };
        });
        await Application.insertMany(applications);
        console.log(`Imported ${applications.length} Applications`);

        // 7. Placement Forms (Industry Placements)
        const placementRows = extractValues('industry_placements');
        const placements = placementRows.map(row => {
            const [id, student_id, full_name, address, email, student_id_number, batch_code, has_visa, award_title, emergency_contact, emergency_relationship, company_name, company_address, company_phone, company_email, placement_job_title, placement_job_role, mentor_name, mentor_phone, mentor_email, start_date, end_date, created_at] = row;
            return {
                student: studentMap.get(student_id),
                full_name,
                address,
                email,
                student_id_number,
                batch_code,
                has_visa,
                award_title,
                emergency_contact,
                emergency_relationship,
                company_name,
                company_address,
                company_phone,
                company_email,
                placement_job_title,
                placement_job_role,
                mentor_name,
                mentor_phone,
                mentor_email,
                start_date: new Date(start_date),
                end_date: new Date(end_date),
                position: placement_job_title, // Map to position
                supervisor_name: mentor_name, // Map to supervisor
                supervisor_email: mentor_email, // Map to supervisor
                supervisor_phone: mentor_phone, // Map to supervisor
                description: placement_job_role, // Map to description
            };
        });
        await PlacementForm.insertMany(placements);
        console.log(`Imported ${placements.length} Placement Forms`);

        console.log('Data Import Completed Successfully!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

importData();
