import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "";
const smtpPort = Number(process.env.SMTP_PORT || 0);
const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";
const smtpFromName = process.env.SMTP_FROM_NAME || "Felicity";
const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser || "";

export const isSmtpConfigured = () => {
  return Boolean(smtpHost && smtpPort && smtpUser && smtpPass && smtpFromEmail);
};

export const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: `${smtpFromName} <${smtpFromEmail}>`,
    to,
    subject,
    html,
    attachments,
  });
};

export const buildTicketEmailHtml = ({
  participantName,
  eventTitle,
  eventType,
  startDate,
  endDate,
  ticketId,
  qrCid,
}) => {
  const schedule = `${new Date(startDate).toLocaleString()} - ${new Date(endDate).toLocaleString()}`;
  const safeName = participantName || "Participant";
  const safeType = eventType || "event";

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="margin-bottom: 8px;">Felicity Ticket Confirmation</h2>
      <p>Hello ${safeName},</p>
      <p>Your registration for <b>${eventTitle}</b> is confirmed.</p>
      <p><b>Ticket ID:</b> ${ticketId}</p>
      <p><b>Event Type:</b> ${safeType}</p>
      <p><b>Schedule:</b> ${schedule}</p>
      <p>Scan the QR code below at entry:</p>
      <img src="cid:${qrCid}" alt="QR Code" style="width:180px;height:180px;" />
    </div>
  `;
};
