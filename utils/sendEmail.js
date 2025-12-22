const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Create a transporter
    // For production, use environment variables for host, port, user, pass
    // Create a transporter
    // Create a transporter
    // MailSender SMTP Configuration (Defaults to MailSender if env vars missing)
    // Debugging Environment Variables
    const emailUser = process.env.EMAIL_USERNAME;
    const emailPass = process.env.EMAIL_PASSWORD;

    if (!emailUser || !emailPass) {
        console.error("❌ CRITICAL ERROR: EMAIL_USERNAME or EMAIL_PASSWORD is missing in Environment Variables!");
        console.error("   - EMAIL_USERNAME present? " + (emailUser ? "YES" : "NO"));
        console.error("   - EMAIL_PASSWORD present? " + (emailPass ? "YES" : "NO"));
        throw new Error("Missing Email Credentials in Railway Variables");
    }

    // Use 'gmail' service preset (Handling Port 465/587 automatically)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPass
        },
        connectionTimeout: 10000
    });

    console.log(`[DEBUG] Transporter Configured. User: ${emailUser ? emailUser.substring(0, 3) + '***' : 'MISSING'}`);

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
