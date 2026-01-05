const fs = require('fs');
const path = './controllers/submissionController.js';
try {
    const content = fs.readFileSync(path, 'utf8');
    // Basic bracket counting
    let open = 0;
    for (let char of content) {
        if (char === '{') open++;
        if (char === '}') open--;
    }
    console.log(`Open braces: ${open}`);
    if (open !== 0) console.log("MISMATCH FOUND");

    require(path); // Try to load it
    console.log("Syntax OK");
} catch (e) {
    console.error(e);
}
