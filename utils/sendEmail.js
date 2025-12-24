const nodemailer = require('nodemailer');

const sendEmail = async (options) => {

    // Create Transporter
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    console.log(`[DEBUG] Nodemailer Configured. Sending email to: ${options.email}`);

    const mailOptions = {
        from: `${process.env.FROM_NAME || 'Internship Manager'} <${process.env.EMAIL_USERNAME}>`,
        to: options.email,
        subject: options.subject,
        html: options.isHtml ? options.message : `<p>${options.message}</p>`,
        text: options.isHtml ? "Please view this email in a client that supports HTML." : options.message
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully! Message ID:', info.messageId);
        return info;
    } catch (error) {
        console.error("❌ Nodemailer Error:", error);
        throw new Error(error.message);
    }
};

module.exports = sendEmail;
