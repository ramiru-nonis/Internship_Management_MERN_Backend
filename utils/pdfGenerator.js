const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateMarksheetPDF = (student, mentor, marks, comments, filePath) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // --- Header ---
        doc.fontSize(20).font('Helvetica-Bold').text('Academic Mentor Marksheet', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
        doc.moveDown();

        // --- Student & Mentor Details ---
        doc.rect(50, 100, 500, 80).stroke('#333');

        doc.fontSize(12).font('Helvetica-Bold').text('Student Details', 60, 110);
        doc.font('Helvetica')
            .text(`Name: ${student.first_name} ${student.last_name}`, 60, 130)
            .text(`CB Number: ${student.cb_number || 'N/A'}`, 60, 145)
            .text(`Degree: ${student.degree} (${student.degree_level})`, 60, 160);

        doc.font('Helvetica-Bold').text('Mentor Details', 300, 110);
        doc.font('Helvetica')
            .text(`Name: ${mentor.first_name} ${mentor.last_name}`, 300, 130)
            .text(`Email: ${mentor.email}`, 300, 145);

        doc.moveDown(4);

        // --- Marks Table ---
        const tableTop = 230;
        const itemX = 50;
        const marksX = 350;
        const maxX = 450;
        const padding = 10;

        // Table Header
        doc.rect(itemX, tableTop, 500, 25).fill('#eee').stroke();
        doc.fillColor('black').font('Helvetica-Bold');
        doc.text('Evaluation Criteria', itemX + padding, tableTop + 7);
        doc.text('Marks Obtained', marksX + padding, tableTop + 7);
        doc.text('Max Marks', maxX + padding, tableTop + 7);

        // Rows
        let y = tableTop + 25;
        const rowHeight = 60; // Increased height for comments

        const drawRow = (title, mark, maxMark, comment) => {
            // Row Border
            doc.rect(itemX, y, 500, rowHeight).stroke();

            // Text
            doc.font('Helvetica-Bold').text(title, itemX + padding, y + 10);
            doc.font('Helvetica').text(mark.toString(), marksX + padding, y + 10);
            doc.font('Helvetica').text(maxMark.toString(), maxX + padding, y + 10);

            // Comment
            doc.fontSize(10).font('Helvetica-Oblique').fillColor('#555')
                .text(`Comment: ${comment || 'No comments'}`, itemX + padding, y + 30, { width: 480 });

            doc.fontSize(12).fillColor('black'); // Reset
            y += rowHeight;
        };

        drawRow('Technical Skill Development', marks.technical, 20, comments.technical);
        drawRow('Soft Skill Development', marks.softSkills, 20, comments.softSkills);
        drawRow('Presentation Skills', marks.presentation, 20, comments.presentation);

        // --- Total ---
        y += 10;
        doc.fontSize(14).font('Helvetica-Bold')
            .text('Total Marks:', 300, y)
            .text(`${marks.total} / 60`, 420, y);

        // --- Footer ---
        doc.fontSize(10).font('Helvetica').fillColor('#777')
            .text('This is a system-generated document. No signature required.', 50, 700, { align: 'center', width: 500 });

        doc.end();

        stream.on('finish', () => resolve(filePath));
        stream.on('error', (err) => reject(err));
    });
};

module.exports = { generateMarksheetPDF };
