const PDFDocument = require('pdfkit');
const Student = require('../models/Student');
const Logbook = require('../models/Logbook');
const PlacementForm = require('../models/PlacementForm');
const path = require('path');
const fs = require('fs');

// Generate Full Student Report
exports.generateStudentReport = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch Data
        // Student Profile
        const student = await Student.findOne({ user: id }).populate('user');
        if (!student) return res.status(404).json({ message: "Student profile not found" });

        // Placement Details
        const placement = await PlacementForm.findOne({ student: student._id });

        // Logbook History (Only Approved)
        const logbooks = await Logbook.find({
            studentId: student.user._id,
            status: 'Approved'
        }).sort({ year: 1, month: 1 });

        // 2. Init PDF
        const doc = new PDFDocument({ margin: 50 });

        // Stream to response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Student_Report_${student.cb_number || 'ST'}.pdf`);
        doc.pipe(res);

        // --- COVER PAGE ---
        doc.fontSize(24).font('Helvetica-Bold').text('Internship Student Record', { align: 'center' });
        doc.moveDown(2);

        // Student Info
        doc.fontSize(14).font('Helvetica-Bold').text('Student Information');
        doc.rect(doc.x, doc.y + 5, 500, 1).stroke(); // Underline
        doc.moveDown();

        doc.fontSize(12).font('Helvetica');
        const infoX = 50;
        const valueX = 200;
        const lineGap = 20;

        let curY = doc.y;
        doc.text('Name:', infoX, curY); doc.text(`${student.first_name} ${student.last_name}`, valueX, curY);
        curY += lineGap;
        doc.text('CB Number:', infoX, curY); doc.text(student.cb_number || 'N/A', valueX, curY);
        curY += lineGap;
        doc.text('Degree:', infoX, curY); doc.text(student.degree || 'N/A', valueX, curY);
        curY += lineGap;
        doc.text('Email:', infoX, curY); doc.text(student.user?.email || 'N/A', valueX, curY);
        curY += lineGap;
        doc.text('Contact:', infoX, curY); doc.text(student.contact_number || 'N/A', valueX, curY);

        doc.moveDown(2);

        // Internship Info
        if (placement) {
            doc.fontSize(14).font('Helvetica-Bold').text('Internship Placement Details');
            doc.rect(doc.x, doc.y + 5, 500, 1).stroke();
            doc.moveDown();

            doc.fontSize(12).font('Helvetica');
            curY = doc.y;
            doc.text('Company:', infoX, curY); doc.text(placement.company_name || 'N/A', valueX, curY);
            curY += lineGap;
            doc.text('Position:', infoX, curY); doc.text(placement.position || 'N/A', valueX, curY);
            curY += lineGap;
            doc.text('Supervisor:', infoX, curY); doc.text(placement.supervisor_name || 'N/A', valueX, curY);
            curY += lineGap;
            doc.text('Supervisor Email:', infoX, curY); doc.text(placement.supervisor_email || 'N/A', valueX, curY);
            curY += lineGap;
            doc.text('Start Date:', infoX, curY); doc.text(placement.start_date ? new Date(placement.start_date).toDateString() : 'N/A', valueX, curY);
            curY += lineGap;
            doc.text('End Date:', infoX, curY); doc.text(placement.end_date ? new Date(placement.end_date).toDateString() : 'N/A', valueX, curY);
        } else {
            doc.fontSize(12).text('No placement details found.', { align: 'left', oblique: true });
        }

        doc.addPage();

        // --- LOGBOOK SUMMARY ---
        doc.fontSize(18).font('Helvetica-Bold').text('Logbook Summary', { align: 'center' });
        doc.moveDown();

        if (logbooks.length > 0) {
            for (const lb of logbooks) {
                // Month Header
                if (doc.y > 650) doc.addPage();

                doc.fontSize(14).font('Helvetica-Bold').fillColor('#0056b3').text(`Month: ${lb.month} / ${lb.year}`, { underline: true });
                doc.fillColor('black').fontSize(10).font('Helvetica').text(`Status: ${lb.status} | Industry Approved: ${lb.isIndustryApproved ? 'Yes' : 'No'}`);
                doc.moveDown(0.5);

                const tableTop = doc.y;
                const colWidths = { week: 40, content: 450 };
                const startX = 50;

                // Table Header
                doc.font('Helvetica-Bold').fontSize(10);
                doc.rect(startX, doc.y, colWidths.week, 20).stroke();
                doc.rect(startX + colWidths.week, doc.y, colWidths.content, 20).stroke();
                doc.text('Week', startX + 5, doc.y + 5);
                doc.text('Activities / Skills / Trainings', startX + colWidths.week + 5, doc.y + 5);

                doc.y += 20;

                // Rows
                if (lb.weeks && lb.weeks.length > 0) {
                    lb.weeks.sort((a, b) => a.weekNumber - b.weekNumber).forEach(week => {
                        const rowY = doc.y;
                        const contentText = `Activities: ${week.activities}\nTech Skills: ${week.techSkills}\nSoft Skills: ${week.softSkills}\nTrainings: ${week.trainings}`;

                        doc.font('Helvetica').fontSize(9);
                        const contentHeight = doc.heightOfString(contentText, { width: colWidths.content - 10 }) + 10;

                        // Check Page Break
                        if (rowY + contentHeight > 700) {
                            doc.addPage();
                            doc.y = 50;
                        }

                        const finalY = doc.y; // Update Y after possible page break

                        doc.rect(startX, finalY, colWidths.week, contentHeight).stroke();
                        doc.rect(startX + colWidths.week, finalY, colWidths.content, contentHeight).stroke();

                        doc.text(week.weekNumber.toString(), startX + 5, finalY + 5, { width: colWidths.week - 10, align: 'center' });
                        doc.text(contentText, startX + colWidths.week + 5, finalY + 5, { width: colWidths.content - 10 });

                        doc.y = finalY + contentHeight;
                    });
                } else {
                    doc.text('No entries.', { italic: true });
                }

                doc.moveDown(1);
            }
        } else {
            doc.text('No approved logbooks found.', { align: 'center' });
        }

        // Footer
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).text(
                `Page ${i + 1} of ${range.count}`,
                50,
                doc.page.height - 50,
                { align: 'center' }
            );
        }

        doc.end();

    } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({ message: "Failed to generate report", error: error.message });
    }
};
