const https = require('https');

const url = 'https://internship-management-backend-production.up.railway.app/api/logbooks/action/6946b60d67afa5d15e00ad93/Approved';

https.get(url, (res) => {
    console.log('Status:', res.statusCode);
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Body:', data);
    });
}).on('error', (e) => {
    console.error(e);
});
