require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
    console.log('Testing Resend email...');
    console.log('API Key present:', !!process.env.RESEND_API_KEY);

    try {
        const { data, error } = await resend.emails.send({
            from: 'Internship Manager <onboarding@resend.dev>',
            to: 'ramirunonis2006@gmail.com',  // Send to YOUR email for testing (Resend free tier restriction)
            subject: 'Logbook Approval Required - Student: ramirunonis2006@gmail.com',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">Logbook Approval Request</h2>
                    <p>Dear Mentor,</p>
                    <p>A student has submitted their logbook for your approval.</p>
                    
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Student Email:</strong> ramirunonis2006@gmail.com</p>
                        <p><strong>Submission Date:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <p>Please review the logbook and approve or reject it.</p>
                    
                    <p style="margin-top: 30px;">Best regards,<br>Internship Management System</p>
                </div>
            `
        });

        if (error) {
            console.error('Error details:', JSON.stringify(error, null, 2));
        } else {
            console.log('Email sent successfully!');
            console.log('Email ID:', data.id);
        }
    } catch (err) {
        console.error('Exception:', err.message);
    }
}

testEmail();
