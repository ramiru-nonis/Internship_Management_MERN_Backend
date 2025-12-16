const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Create a transporter
    // For production, use environment variables for host, port, user, pass
    // Create a transporter
    // Create a transporter
    // MailSender SMTP Configuration (Defaults to MailSender if env vars missing)
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.mailersend.net',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USERNAME, // User prefers using just these
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
