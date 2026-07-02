import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    return transporter;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Email service is not configured');
  }

  // Development transport captures the message without contacting an SMTP server.
  transporter = nodemailer.createTransport({ jsonTransport: true });
  return transporter;
};

export const sendEmail = async ({ to, subject, text, html }) => {
  const info = await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'Complete CRM <no-reply@example.com>',
    to,
    subject,
    text,
    html,
    disableFileAccess: true,
    disableUrlAccess: true
  });

  return {
    messageId: info.messageId,
    preview: info.message?.toString()
  };
};

export const sendPasswordResetEmail = async ({ user, resetUrl }) => sendEmail({
  to: user.email,
  subject: 'Reset your CRM password',
  text: `Use this link to reset your password: ${resetUrl}. The link expires in 30 minutes.`,
  html: `<p>Hello ${user.name},</p><p>Use the link below to reset your password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`
});
