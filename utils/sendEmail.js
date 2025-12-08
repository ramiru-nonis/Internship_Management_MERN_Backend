const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Create a transporter
    // For production, use environment variables for host, port, user, pass
    const transporter = nodemailer.createTransport({
        service: 'gmail', // or your preferred service
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    // Define email options
    const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@internshipmanager.com',
        to: options.email,
        subject: options.subject,
        text: options.isHtml ? undefined : options.message, // Send text only if not HTML
        html: options.isHtml ? options.message : options.html // Use message as HTML if isHtml is true
    };

    // Send email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
