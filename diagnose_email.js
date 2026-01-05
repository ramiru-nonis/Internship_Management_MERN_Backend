const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const diagnoseEmail = async () => {
    console.log("--- Starting Email Diagnosis ---");
    console.log("1. Checking Environment Variables...");

    const user = process.env.EMAIL_USERNAME;
    const pass = process.env.EMAIL_PASSWORD; // Don't log this
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = process.env.SMTP_PORT || 587;

    if (!user) {
        console.error("❌ ERROR: EMAIL_USERNAME is missing from .env");
        process.exit(1);
    } else {
        console.log(`✅ EMAIL_USERNAME found: ${user}`);
    }

    if (!pass) {
        console.error("❌ ERROR: EMAIL_PASSWORD is missing from .env");
        process.exit(1);
    } else {
        console.log(`✅ EMAIL_PASSWORD found (length: ${pass.length})`);
    }

    console.log(`2. Configuring Transporter (${host}:${port})...`);

    const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: false,
        auth: {
            user: user,
            pass: pass
        }
    });

    try {
        console.log("3. Verifying SMTP Connection...");
        await transporter.verify();
        console.log("✅ SMTP Connection Successful!");
    } catch (error) {
        console.error("❌ SMTP Connection FAILED:");
        console.error(error);
        console.log("\n💡 TIP: If using Gmail, ensure you are using an 'App Password', not your login password.");
        process.exit(1);
    }

    try {
        console.log("4. Sending Test Email...");
        const targetEmail = "dulainmu@gmail.com";
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || user,
            to: targetEmail,
            subject: "NextStep Diagnosis Test Email",
            text: "This is a test email from the diagnose_email.js script. If you see this, your email credentials works!"
        });
        console.log(`✅ Email Sent Successfully!`);
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Recipient: ${targetEmail}`);
    } catch (error) {
        console.error("❌ Sending Email FAILED:");
        console.error(error);
    }

    console.log("--- Diagnosis Complete ---");
};

diagnoseEmail();
