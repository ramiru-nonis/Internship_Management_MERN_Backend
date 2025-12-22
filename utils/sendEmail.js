const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Create a transporter
    // For production, use environment variables for host, port, user, pass
    // Create a transporter
    // Create a transporter
    // MailSender SMTP Configuration (Defaults to MailSender if env vars missing)
    const port = process.env.SMTP_PORT || 587;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: port,
        secure: port == 465, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000     // 5 seconds
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
    try {
        console.log(`[DEBUG] Attempting to send email to: ${options.email}`);
        console.log(`[DEBUG] SMTP Config - Host: ${transporter.options.host}, Port: ${transporter.options.port}, User: ${transporter.options.auth.user}`);

        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
        throw error; // Re-throw to be caught by controller
    }
};

module.exports = sendEmail;
