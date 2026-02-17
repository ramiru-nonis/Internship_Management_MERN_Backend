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
            console.log(`[DEBUG] Processing PDF Path: ${pdfPath}`);

            if (pdfPath.startsWith('http')) {
                try {
                    console.log(`[DEBUG] Fetching remote PDF from: ${pdfPath}`);
                    const response = await axios.get(pdfPath, { responseType: 'arraybuffer' });
                    pdfBytes = response.data;
                    console.log(`[DEBUG] Successfully fetched remote PDF. Size: ${pdfBytes.byteLength} bytes`);
                } catch (fetchErr) {
                    console.error(`[DEBUG] Failed to fetch remote PDF: ${pdfPath}. Error:`, fetchErr.message);
                    continue;
                }
            } else {
                // Handle relative paths
                const fullPath = path.isAbsolute(pdfPath) ? pdfPath : path.join(__dirname, '..', pdfPath);
                console.log(`[DEBUG] Reading local PDF from: ${fullPath}`);
                if (fs.existsSync(fullPath)) {
                    pdfBytes = fs.readFileSync(fullPath);
                    console.log(`[DEBUG] Successfully read local PDF. Size: ${pdfBytes.length} bytes`);
                } else {
                    console.warn(`[DEBUG] File not found: ${fullPath}`);
                    continue;
                }
            }

            try {
                const pdf = await PDFDocument.load(pdfBytes);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
                console.log(`[DEBUG] Added pages from PDF: ${pdfPath}`);
            } catch (loadErr) {
                console.error(`[DEBUG] Error loading PDF into pdf-lib: ${pdfPath}. Error:`, loadErr.message);
                continue; // Skip this PDF if it can't be loaded
            }
        }

        const mergedPdfBytes = await mergedPdf.save();

        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, mergedPdfBytes);
        console.log(`[DEBUG] Successfully saved merged PDF to: ${outputPath}`);
        return true;
    } catch (error) {
        console.error('[DEBUG] Global error in mergePDFs:', error);
        return false;
    }
}

module.exports = { mergePDFs };
