const SibApiV3Sdk = require('sib-api-v3-sdk');
const logger = require('../utils/logger');

const API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'harinarayanantr.thoovara@gmail.com';
const FROM_NAME = 'ChatNow';

let apiInstance = null;
try {
  const client = SibApiV3Sdk.ApiClient.instance;
  const apiKey = client.authentications['api-key'];
  apiKey.apiKey = API_KEY;
  apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
} catch (error) {
  logger.error('Brevo SDK init failed:', error.message);
}

const sendEmail = async ({ to, subject, htmlContent }) => {
  if (!API_KEY) return logger.warn('BREVO_API_KEY not set, skipping email to', to);
  if (!apiInstance) return logger.warn('Brevo not initialized, skipping email to', to);
  try {
    const sendSmtpEmail = {
      to: [{ email: to }],
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      subject,
      htmlContent
    };
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    logger.info(`Email sent to ${to}: "${subject}"`);
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error.message);
  }
};

const getDeviceInfo = (userAgent) => {
  if (!userAgent) return 'Unknown device';
  let info = '';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) info = 'Chrome';
  else if (userAgent.includes('Firefox')) info = 'Firefox';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) info = 'Safari';
  else if (userAgent.includes('Edg')) info = 'Edge';
  else info = 'Unknown browser';

  if (userAgent.includes('Windows')) info += ' on Windows';
  else if (userAgent.includes('Mac OS')) info += ' on macOS';
  else if (userAgent.includes('Linux')) info += ' on Linux';
  else if (userAgent.includes('Android')) info += ' on Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) info += ' on iOS';
  else info += ' on Unknown OS';

  return info;
};

const sendWelcomeEmail = async (userEmail, username) => {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #000; color: #fff; padding: 40px 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 16px; padding: 40px;">
    <h1 style="font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 8px;">Welcome to ChatNow</h1>
    <p style="color: #888; font-size: 16px; margin: 0 0 28px;">Hi ${username}, glad to have you onboard!</p>

    <p style="color: #ccc; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      ChatNow is a real-time messaging platform where you can connect with others instantly. Here's what you can do:
    </p>

    <ul style="color: #aaa; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0 0 28px;">
      <li><strong style="color: #fff;">Global Chat</strong> — Join the public conversation and chat with everyone on the platform.</li>
      <li><strong style="color: #fff;">Create Rooms</strong> — Make your own private or public rooms with optional passwords.</li>
      <li><strong style="color: #fff;">Join Rooms</strong> — Find and join rooms created by other users.</li>
      <li><strong style="color: #fff;">Real-time Messaging</strong> — Messages are delivered instantly with no page refresh needed.</li>
      <li><strong style="color: #fff;">Typing Indicators</strong> — See when someone is typing a reply.</li>
      <li><strong style="color: #fff;">Message Reactions</strong> — React to messages with emojis.</li>
    </ul>

    <p style="color: #ccc; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
      Jump right in and start chatting! If you have any questions, feedback, or need help, feel free to reach out to the developer:
    </p>

    <p style="text-align: center; margin: 0 0 28px;">
      <a href="mailto:error40404.github@gmail.com" style="color: #fff; font-size: 16px; font-weight: 600;">error40404.github@gmail.com</a>
    </p>

    <p style="color: #666; font-size: 13px; text-align: center; border-top: 1px solid #1a1a1a; padding-top: 20px; margin: 0;">
      ChatNow &mdash; Real-time messaging for everyone.
    </p>
  </div>
</body>
</html>`;

  await sendEmail({
    to: userEmail,
    subject: 'Welcome to ChatNow!',
    htmlContent
  });
};

const sendLoginNotification = async (userEmail, username, ip, deviceInfo) => {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #000; color: #fff; padding: 40px 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 16px; padding: 40px;">
    <h1 style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 8px;">New Sign-in</h1>
    <p style="color: #888; font-size: 16px; margin: 0 0 28px;">Hi ${username}, you signed in to ChatNow successfully.</p>

    <div style="background: #111; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
      <p style="color: #aaa; font-size: 14px; margin: 0 0 12px;"><strong style="color: #fff;">Device:</strong> ${deviceInfo}</p>
      <p style="color: #aaa; font-size: 14px; margin: 0 0 12px;"><strong style="color: #fff;">IP Address:</strong> ${ip || 'Unknown'}</p>
      <p style="color: #aaa; font-size: 14px; margin: 0;"><strong style="color: #fff;">Time:</strong> ${new Date().toLocaleString()}</p>
    </div>

    <p style="color: #ccc; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      If this was you, feel free to ignore this email. If this wasn't you or if you have any concerns, please contact support immediately:
    </p>

    <p style="text-align: center; margin: 0 0 28px;">
      <a href="mailto:harinarayanantr.thoovara@gmail.com" style="color: #fff; font-size: 16px; font-weight: 600;">harinarayanantr.thoovara@gmail.com</a>
    </p>

    <p style="color: #666; font-size: 13px; text-align: center; border-top: 1px solid #1a1a1a; padding-top: 20px; margin: 0;">
      ChatNow &mdash; Real-time messaging for everyone.
    </p>
  </div>
</body>
</html>`;

  await sendEmail({
    to: userEmail,
    subject: 'New Sign-in to ChatNow',
    htmlContent
  });
};

module.exports = { sendWelcomeEmail, sendLoginNotification, getDeviceInfo };
