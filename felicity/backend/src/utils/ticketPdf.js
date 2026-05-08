import PDFDocument from "pdfkit";

const dataUrlToBuffer = (dataUrl) => {
  if (!dataUrl) return null;
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  return Buffer.from(parts[1], "base64");
};

export const buildTicketPdfBuffer = async ({
  ticketId,
  eventTitle,
  eventType,
  startDate,
  endDate,
  participantName,
  participantEmail,
  qrDataUrl,
}) => {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(20).text("Felicity Ticket", { align: "center" });
  doc.moveDown(1);

  doc.fontSize(12);
  doc.text(`Ticket ID: ${ticketId}`);
  doc.text(`Event: ${eventTitle}`);
  doc.text(`Type: ${eventType}`);
  doc.text(`Schedule: ${new Date(startDate).toLocaleString()} - ${new Date(endDate).toLocaleString()}`);
  doc.moveDown(1);

  doc.text(`Participant: ${participantName || "Participant"}`);
  doc.text(`Email: ${participantEmail}`);
  doc.moveDown(1.5);

  const qrBuffer = dataUrlToBuffer(qrDataUrl);
  if (qrBuffer) {
    doc.text("Scan QR at entry:");
    doc.image(qrBuffer, { fit: [180, 180] });
  }

  doc.end();

  return await new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
};
