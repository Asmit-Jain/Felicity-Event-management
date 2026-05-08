import User from "../models/User.js";
import Event from "../models/Event.js";
import crypto from "crypto";
import { hashPassword } from "../utils/password.js";
import Ticket from "../models/Ticket.js";
import QRCode from "qrcode";
import { sendEmail, isSmtpConfigured, buildTicketEmailHtml } from "../utils/mailer.js";

const generatePassword = () => {
  // 12 chars, URL-safe-ish
  return crypto
    .randomBytes(9)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12);
};

const slugify = (value) => {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30);
};

const splitOrganizerName = (organizerName) => {
  const normalizedOrganizerName = String(organizerName || "").trim();
  const nameParts = normalizedOrganizerName.split(/\s+/).filter(Boolean);
  return {
    normalizedOrganizerName,
    derivedFirstName: nameParts[0] || "",
    derivedLastName: nameParts[1] || "",
  };
};

/*
  @desc    Create new organizer account (provisioned by admin)
  @route   POST /api/admin/organizers
  @access  Admin
*/
export const createOrganizer = async (req, res) => {
  try {
    const {
      organizerName,
      organizerCategory,
      organizerDescription,
      organizerContactEmail,
    } = req.body;

    const { normalizedOrganizerName, derivedFirstName, derivedLastName } =
      splitOrganizerName(organizerName);

    if (!normalizedOrganizerName || !organizerCategory) {
      return res.status(400).json({
        message: "Organizer name and category are required",
      });
    }

    const base = slugify(normalizedOrganizerName) || "organizer";

    // Auto-generate login email + password. (Email is only used for login; not necessarily a real inbox.)
    let loginEmail = `${base}@felicity.internal`;
    let counter = 0;
    while (await User.findOne({ email: loginEmail })) {
      counter += 1;
      loginEmail = `${base}.${counter}@felicity.internal`;
      if (counter > 50) break;
    }

    if (counter > 50) {
      return res.status(500).json({
        message: "Failed to generate unique organizer login email",
      });
    }

    const plainPassword = generatePassword();
    const hashedPassword = await hashPassword(plainPassword);

    const organizer = await User.create({
      firstName: derivedFirstName,
      lastName: derivedLastName,
      email: loginEmail,
      password: hashedPassword,
      role: "organizer",
      isActive: true,
      archivedAt: null,
      organizerName: normalizedOrganizerName,
      organizerCategory,
      organizerDescription: organizerDescription || null,
      organizerContactEmail: organizerContactEmail
        ? String(organizerContactEmail).toLowerCase().trim()
        : null,
      contactNumber: null,
      participantType: null,
      collegeOrOrg: null,
      interests: [],
      followedOrganizers: [],
    });

    return res.status(201).json({
      message: "Organizer account created",
      organizerId: organizer._id,
      loginEmail,
      password: plainPassword,
    });
  } catch (error) {
    console.error("Create organizer error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Block organizer
  @route   PUT /api/admin/block/:userId
  @access  Admin
*/
export const listOrganizers = async (req, res) => {
  try {
    const organizers = await User.find({ role: "organizer" })
      .select(
        "organizerName organizerCategory organizerDescription organizerContactEmail isActive archivedAt createdAt email"
      )
      .sort({ organizerName: 1, createdAt: -1 });

    res.json(organizers);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Unblock organizer
  @route   PUT /api/admin/unblock/:userId
  @access  Admin
*/
export const updateOrganizer = async (req, res) => {
  try {
    const organizer = await User.findById(req.params.id);

    if (!organizer || organizer.role !== "organizer") {
      return res.status(404).json({ message: "Organizer not found" });
    }

    const allowed = [
      "organizerName",
      "organizerCategory",
      "organizerDescription",
      "organizerContactEmail",
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        organizer[key] = req.body[key];
      }
    }

    if (req.body.organizerContactEmail !== undefined) {
      organizer.organizerContactEmail = req.body.organizerContactEmail
        ? String(req.body.organizerContactEmail).toLowerCase().trim()
        : null;
    }

    if (req.body.organizerName !== undefined) {
      const { normalizedOrganizerName, derivedFirstName, derivedLastName } =
        splitOrganizerName(req.body.organizerName);
      organizer.organizerName = normalizedOrganizerName;
      organizer.firstName = derivedFirstName;
      organizer.lastName = derivedLastName;
    }

    await organizer.save();

    res.json({ message: "Organizer updated" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const disableOrganizer = async (req, res) => {
  try {
    const organizer = await User.findById(req.params.id);

    if (!organizer || organizer.role !== "organizer") {
      return res.status(404).json({ message: "Organizer not found" });
    }

    organizer.isActive = false;
    await organizer.save();

    res.json({ message: "Organizer disabled" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const enableOrganizer = async (req, res) => {
  try {
    const organizer = await User.findById(req.params.id);

    if (!organizer || organizer.role !== "organizer") {
      return res.status(404).json({ message: "Organizer not found" });
    }

    organizer.isActive = true;
    await organizer.save();

    res.json({ message: "Organizer enabled" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const archiveOrganizer = async (req, res) => {
  try {
    const organizer = await User.findById(req.params.id);

    if (!organizer || organizer.role !== "organizer") {
      return res.status(404).json({ message: "Organizer not found" });
    }

    organizer.isActive = false;
    organizer.archivedAt = new Date();
    await organizer.save();

    res.json({ message: "Organizer archived" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteOrganizer = async (req, res) => {
  try {
    const organizer = await User.findById(req.params.id);

    if (!organizer || organizer.role !== "organizer") {
      return res.status(404).json({ message: "Organizer not found" });
    }

    await Event.updateMany(
      { organizer: organizer._id },
      { $set: { status: "draft" } }
    );

    await organizer.deleteOne();

    res.json({ message: "Organizer removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Resend ticket email
  @route   PUT /api/admin/tickets/:id/resend
  @access  Admin
*/
export const resendTicketEmail = async (req, res) => {
  try {
    if (!isSmtpConfigured()) {
      return res.status(400).json({ message: "SMTP is not configured" });
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate("event")
      .populate("participant");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const participantName = `${ticket.participant?.firstName || ""} ${
      ticket.participant?.lastName || ""
    }`.trim();

    const qrCid = `ticket-${ticket._id}`;
    const qrBuffer = await QRCode.toBuffer(ticket.qrData);
    const emailHtml = buildTicketEmailHtml({
      participantName,
      eventTitle: ticket.event?.title || "Event",
      eventType: ticket.event?.eventType || "event",
      startDate: ticket.event?.startDate,
      endDate: ticket.event?.endDate,
      ticketId: ticket.ticketId,
      qrCid,
    });

    const attemptAt = new Date();

    await sendEmail({
      to: ticket.participant?.email,
      subject: `Ticket Confirmation: ${ticket.event?.title || "Event"}`,
      html: emailHtml,
      attachments: [
        {
          filename: `ticket-${ticket.ticketId}.png`,
          content: qrBuffer,
          contentType: "image/png",
          cid: qrCid,
        },
      ],
    });

    await Ticket.updateOne(
      { _id: ticket._id },
      { $set: { emailStatus: "sent", emailedAt: attemptAt, lastEmailAttemptAt: attemptAt, emailError: null } }
    );

    res.json({ message: "Ticket email resent" });
  } catch (error) {
    await Ticket.updateOne(
      { _id: req.params.id },
      {
        $set: {
          emailStatus: "failed",
          emailError: error.message || "Email send failed",
          lastEmailAttemptAt: new Date(),
        },
      }
    );
    res.status(500).json({ message: "Failed to resend ticket email" });
  }
};
