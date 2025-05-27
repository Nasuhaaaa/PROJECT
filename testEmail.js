const nodemailer = require('nodemailer');

async function sendTestEmail() {
  let transporter = nodemailer.createTransport({
    host: 'localhost',
    port: 1025,
    secure: false,
  });

  let info = await transporter.sendMail({
    from: '"Test Sender" <test@example.com>',
    to: 'receiver@example.com',
    subject: 'Hello from MailDev test',
    text: 'This is a test email to check MailDev',
  });

  console.log('Message sent:', info.messageId);
}

sendTestEmail().catch(console.error);
