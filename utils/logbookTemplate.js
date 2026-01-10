const PDFDocument = require('pdfkit');

const generateLogbookPDF = (logbook, studentData, res) => {
    const doc = new PDFDocument({ margin: 50 });

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Monthly Internship Logbook', { align: 'center' });
    doc.moveDown();

    // Student Details
    doc.fontSize(12).font('Helvetica-Bold').text('Student Details');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Name: ${studentData.first_name} ${studentData.last_name}`);
    doc.text(`CB Number: ${studentData.cb_number || 'N/A'}`);
    doc.text(`Degree: ${studentData.degree || 'N/A'}`);
    doc.text(`Month/Year: ${logbook.month}/${logbook.year}`);
    doc.text(`Status: ${logbook.status}`);
    doc.moveDown();

    // Table Content
    if (logbook.weeks && logbook.weeks.length > 0) {
        logbook.weeks.sort((a, b) => a.weekNumber - b.weekNumber).forEach((week) => {
            doc.font('Helvetica-Bold').fontSize(11).text(`Week ${week.weekNumber}`, { underline: true });
            doc.moveDown(0.5);

            const options = { width: 500, align: 'justify' };

            doc.font('Helvetica-Bold').fontSize(10).text('Activities:');
            doc.font('Helvetica').fontSize(10).text(week.activities || 'N/A', options);
            doc.moveDown(0.5);

            doc.font('Helvetica-Bold').text('Technical Skills:');
            doc.font('Helvetica').text(week.techSkills || 'N/A', options);
            doc.moveDown(0.5);

            doc.font('Helvetica-Bold').text('Soft Skills:');
            doc.font('Helvetica').text(week.softSkills || 'N/A', options);
            doc.moveDown(0.5);

            doc.font('Helvetica-Bold').text('Trainings:');
            doc.font('Helvetica').text(week.trainings || 'N/A', options);
            doc.moveDown(1);
        });
    } else {
        doc.text('No weekly entries found for this logbook.');
    }

    // Footer/Metadata
    doc.fontSize(8).fillColor('grey').text(`Generated on ${new Date().toLocaleString()}`, { align: 'right' });

    doc.end();
};

module.exports = { generateLogbookPDF };
