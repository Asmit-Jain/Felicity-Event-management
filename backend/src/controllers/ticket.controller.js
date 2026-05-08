import Ticket from "../models/Ticket.js";
import { buildTicketPdfBuffer } from "../utils/ticketPdf.js";

export const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("event")
      .populate("participant", "firstName lastName email role");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (req.user.role === "participant" && String(ticket.participant?._id) !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const downloadTicketPdf = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("event")
      .populate("participant", "firstName lastName email role");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (req.user.role === "participant" && String(ticket.participant?._id) !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const pdfBuffer = await buildTicketPdfBuffer({
      ticketId: ticket.ticketId,
      eventTitle: ticket.event?.title || "Event",
      eventType: ticket.event?.eventType || "event",
      startDate: ticket.event?.startDate,
      endDate: ticket.event?.endDate,
      participantName: `${ticket.participant?.firstName || ""} ${ticket.participant?.lastName || ""}`.trim(),
      participantEmail: ticket.participant?.email,
      qrDataUrl: ticket.qrDataUrl,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ticket-${ticket.ticketId}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
