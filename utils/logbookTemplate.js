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
        const colWidths = {
            week: 40,
            activities: 125,
            tech: 110,
            soft: 110,
            trainings: 115
        };
        const startX = 50;
        const colPositions = {
            week: startX,
            activities: startX + colWidths.week,
            tech: startX + colWidths.week + colWidths.activities,
            soft: startX + colWidths.week + colWidths.activities + colWidths.tech,
            trainings: startX + colWidths.week + colWidths.activities + colWidths.tech + colWidths.soft
        };
        const rowHeight = 25;

        doc.font('Helvetica-Bold').fontSize(9);

        // Draw Header Boxes and Text
        Object.keys(colWidths).forEach(key => {
            doc.rect(colPositions[key], tableTop, colWidths[key], rowHeight).stroke();
        });

        doc.text('Week', colPositions.week + 5, tableTop + 7, { width: colWidths.week - 10, align: 'center' });
        doc.text('Activities', colPositions.activities + 5, tableTop + 7, { width: colWidths.activities - 10, align: 'center' });
        doc.text('Technical Skills', colPositions.tech + 5, tableTop + 7, { width: colWidths.tech - 10, align: 'center' });
        doc.text('Soft Skills', colPositions.soft + 5, tableTop + 7, { width: colWidths.soft - 10, align: 'center' });
        doc.text('Trainings', colPositions.trainings + 5, tableTop + 7, { width: colWidths.trainings - 10, align: 'center' });

        doc.y = tableTop + rowHeight;

        sortedWeeks.forEach((week) => {
            const startY = doc.y;
            doc.font('Helvetica').fontSize(8);

            // Calculate heights for each column content
            const weekText = `Week ${week.weekNumber}`;
            const activitiesText = week.activities || 'N/A';
            const techText = week.techSkills || 'N/A';
            const softText = week.softSkills || 'N/A';
            const trainingsText = week.trainings || 'N/A';

            const options = (width) => ({ width: width - 10, align: 'left' });

            // We need to find the max height among all columns
            const heights = [
                doc.heightOfString(weekText, options(colWidths.week)),
                doc.heightOfString(activitiesText, options(colWidths.activities)),
                doc.heightOfString(techText, options(colWidths.tech)),
                doc.heightOfString(softText, options(colWidths.soft)),
                doc.heightOfString(trainingsText, options(colWidths.trainings))
            ];
            const maxHeight = Math.max(...heights) + 10;

            // Draw content
            doc.text(weekText, colPositions.week + 5, startY + 5, options(colWidths.week));
            doc.text(activitiesText, colPositions.activities + 5, startY + 5, options(colWidths.activities));
            doc.text(techText, colPositions.tech + 5, startY + 5, options(colWidths.tech));
            doc.text(softText, colPositions.soft + 5, startY + 5, options(colWidths.soft));
            doc.text(trainingsText, colPositions.trainings + 5, startY + 5, options(colWidths.trainings));

            // Draw Borders for this row
            Object.keys(colWidths).forEach(key => {
                doc.rect(colPositions[key], startY, colWidths[key], maxHeight).stroke();
            });

            doc.y = startY + maxHeight;

            // Check if we need a new page
            if (doc.y > 700) {
                doc.addPage();
                // Redraw headers on new page if necessary (optional but good)
                // For simplicity, just continue
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
