const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Merges multiple PDF files into a single PDF.
 * @param {string[]} pdfPaths - List of PDF paths or URLs.
 * @param {string} outputPath - Local path to save the merged PDF.
 */
async function mergePDFs(pdfPaths, outputPath) {
    try {
        const mergedPdf = await PDFDocument.create();

        for (const pdfPath of pdfPaths) {
            let pdfBytes;
            if (pdfPath.startsWith('http')) {
                const response = await axios.get(pdfPath, { responseType: 'arraybuffer' });
                pdfBytes = response.data;
            } else {
                // Handle relative paths
                const fullPath = path.isAbsolute(pdfPath) ? pdfPath : path.join(__dirname, '..', pdfPath);
                if (fs.existsSync(fullPath)) {
                    pdfBytes = fs.readFileSync(fullPath);
                } else {
                    console.warn(`File not found: ${fullPath}`);
                    continue;
                }
            }

            const pdf = await PDFDocument.load(pdfBytes);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();

        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, mergedPdfBytes);
        return true;
    } catch (error) {
        console.error('Error merging PDFs:', error);
        return false;
    }
}

module.exports = { mergePDFs };
