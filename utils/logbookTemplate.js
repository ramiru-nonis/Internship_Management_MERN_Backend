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
        const sortedWeeks = logbook.weeks.sort((a, b) => a.weekNumber - b.weekNumber);

        // Table Header
        const tableTop = doc.y;
        const col1Width = 60;
        const col2Width = 440;
        const rowHeight = 20;

        doc.font('Helvetica-Bold').fontSize(10);

        // Draw Header Box
        doc.rect(50, tableTop, col1Width, rowHeight).stroke();
        doc.rect(50 + col1Width, tableTop, col2Width, rowHeight).stroke();

        doc.text('Week', 55, tableTop + 5);
        doc.text('Details', 55 + col1Width, tableTop + 5);

        doc.moveDown(0.8);

        sortedWeeks.forEach((week) => {
            const startY = doc.y;

            // Render Contents first to measure height
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(`Week ${week.weekNumber}`, 55, startY + 5, { width: col1Width - 10 });

            let currentContentY = startY + 5;
            const options = { width: col2Width - 10, align: 'justify' };

            doc.text('Activities:', 55 + col1Width, currentContentY);
            doc.font('Helvetica').text(week.activities || 'N/A', 55 + col1Width, doc.y, options);
            doc.moveDown(0.2);

            doc.font('Helvetica-Bold').text('Technical Skills:', 55 + col1Width, doc.y);
            doc.font('Helvetica').text(week.techSkills || 'N/A', 55 + col1Width, doc.y, options);
            doc.moveDown(0.2);

            doc.font('Helvetica-Bold').text('Soft Skills:', 55 + col1Width, doc.y);
            doc.font('Helvetica').text(week.softSkills || 'N/A', 55 + col1Width, doc.y, options);
            doc.moveDown(0.2);

            doc.font('Helvetica-Bold').text('Trainings:', 55 + col1Width, doc.y);
            doc.font('Helvetica').text(week.trainings || 'N/A', 55 + col1Width, doc.y, options);

            const endY = doc.y + 10;
            const contentHeight = endY - startY;

            // Draw Borders for this row
            doc.rect(50, startY, col1Width, contentHeight).stroke();
            doc.rect(50 + col1Width, startY, col2Width, contentHeight).stroke();

            doc.y = endY;

            // Check if we need a new page
            if (doc.y > 700) {
                doc.addPage();
            }
        });
    } else {
        doc.text('No weekly entries found for this logbook.');
    }

    // Footer/Signature Section
    doc.moveDown(2);
    const bottomY = doc.y;

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('__________________________', 50, bottomY);
    doc.text('Mentor Signature', 50, bottomY + 15);

    doc.text('__________________________', 350, bottomY);
    doc.text('Date', 350, bottomY + 15);

    doc.moveDown(3);
    doc.fontSize(8).fillColor('grey').text(`Generated on ${new Date().toLocaleString()}`, { align: 'right' });

    doc.end();
};

module.exports = { generateLogbookPDF };
