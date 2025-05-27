// emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 1025,
  secure: false,
  tls: { rejectUnauthorized: false }
});

async function sendPolicyUpdateEmail(to, subject, message) {
  const mailOptions = {
    from: 'no-reply@example.com',
    to,
    subject,
    text: message
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to:', to);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
  }
}

module.exports = { sendPolicyUpdateEmail };
