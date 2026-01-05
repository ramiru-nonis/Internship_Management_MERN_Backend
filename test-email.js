require('dotenv').config();
const nodemailer = require('nodemailer');

const testEmail = async () => {
    console.log("Testing Email configuration...");
    console.log("SMTP_HOST:", process.env.SMTP_HOST || 'smtp.gmail.com');
    console.log("SMTP_PORT:", process.env.SMTP_PORT || 587);
    console.log("SMTP_USER:", process.env.EMAIL_USERNAME);

    // Mask password
    const pass = process.env.EMAIL_PASSWORD;
    console.log("SMTP_PASS:", pass ? "****" + pass.slice(-4) : "NOT SET");

    if (!pass) {
        console.error("❌ ERROR: Password is missing in .env file");
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Test" <auracodexs@gmail.com>',
            to: process.env.EMAIL_USERNAME, // Send to self
            subject: "Test Email from MERN Stack",
            text: "If you received this, your SMTP configuration is correct!",
        });

        console.log("✅ Custom Email Sent Successfully!");
        console.log("Message ID:", info.messageId);
    } catch (error) {
        console.error("❌ Failed to send email:");
        console.error(error);
    }
};

testEmail();
