const { Resend } = require('resend');

const sendEmail = async (options) => {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
        console.error("❌ CRITICAL ERROR: RESEND_API_KEY is missing in Environment Variables!");
        throw new Error("Missing RESEND_API_KEY in Railway Variables");
    }

    const resend = new Resend(resendApiKey);

    console.log(`[DEBUG] Resend configured. Sending email to: ${options.email}`);

    try {
        const { data, error } = await resend.emails.send({
            from: 'NextStep Internship <updates@dulain.dev>',
            to: options.email,
            subject: options.subject,
            html: options.isHtml ? options.message : `<p>${options.message}</p>`,
            text: options.isHtml ? undefined : options.message
        });

        if (error) {
            console.error("❌ Resend Error:", error);
            throw new Error(error.message);
        }

        console.log('✅ Email sent successfully! ID:', data.id);
        return data;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
};

module.exports = sendEmail;
