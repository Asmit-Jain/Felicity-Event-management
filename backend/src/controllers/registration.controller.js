import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import User from "../models/User.js";
import Ticket from "../models/Ticket.js";
import { sendEmail, isSmtpConfigured, buildTicketEmailHtml } from "../utils/mailer.js";
import { buildCalendarIcs } from "../utils/calendar.js";
import QRCode from "qrcode";
import { buildTicketPdfBuffer } from "../utils/ticketPdf.js";
import mongoose from "mongoose";

const pickFirstNonEmpty = (obj, keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
};

const extractTeamMetadata = (formResponses) => {
  const responses =
    formResponses && typeof formResponses === "object" ? formResponses : {};

  const teamName = pickFirstNonEmpty(responses, [
    "teamName",
    "team",
    "groupName",
    "squadName",
  ]);

  const rawTeamSize = pickFirstNonEmpty(responses, [
    "teamSize",
    "membersCount",
    "teamMembers",
    "groupSize",
  ]);

  const parsedSize = Number(rawTeamSize);
  const teamSize = Number.isInteger(parsedSize) && parsedSize > 0 ? parsedSize : 1;

  return {
    teamName,
    teamSize,
  };
};

const normalizeAttendanceReason = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const buildAttendanceAuditEntry = ({
  actorId,
  actorRole,
  source,
  action,
  reason = null,
  ticketId = null,
}) => ({
  at: new Date(),
  actor: actorId,
  actorRole: String(actorRole || "unknown"),
  source,
  action,
  reason,
  meta: {
    ticketId: ticketId ? String(ticketId) : null,
  },
});

const toAttendanceRegistrationPayload = (registration) => ({
  id: registration._id,
  participant: registration.participant,
  registeredAt: registration.createdAt,
  status: registration.status,
  teamName: registration.teamName || null,
  teamSize: Number(registration.teamSize || 1),
  attended: Boolean(registration.attended),
  attendedAt: registration.attendedAt || null,
});
/*
  @desc    Register participant for an event
  @route   POST /api/registrations/:eventId
  @access  Participant
*/
export const registerForEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event || event.status !== "published") {
      return res.status(404).json({ message: "Event not available" });
    }

    if (event.registrationsClosed) {
      return res.status(400).json({
        message: "Registrations are closed for this event",
      });
    }

    /* ================= DEADLINE CHECK ================= */

    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({
        message: "Registration deadline has passed",
      });
    }

    /* ================= ELIGIBILITY CHECK ================= */

    const user = await User.findById(req.user.id);
    if (
      event.eligibility !== "Both" &&
      event.eligibility !== user.participantType
    ) {
      return res.status(403).json({
        message: "You are not eligible for this event",
      });
    }

    /* ================= DUPLICATE CHECK ================= */

    const existingRegistration = await Registration.findOne({
      event: event._id,
      participant: req.user.id,
      status: "registered",
    });

    if (existingRegistration) {
      return res.status(409).json({
        message: "You are already registered for this event",
      });
    }

    /* ================= LIMIT CHECK ================= */

    const registrationCount = await Registration.countDocuments({
      event: event._id,
      status: "registered",
    });

    if (registrationCount >= event.registrationLimit) {
      return res.status(400).json({
        message: "Registration limit reached",
      });
    }

    /* ================= TYPE-SPECIFIC INPUT VALIDATION ================= */

    const formResponses =
      req.body && typeof req.body.formResponses === "object" && req.body.formResponses
        ? req.body.formResponses
        : {};

    let merchandiseSelection = null;

    if (event.eventType === "normal") {
      const fields = Array.isArray(event.registrationFormFields)
        ? event.registrationFormFields
        : [];

      for (const field of fields) {
        const key = String(field?.key || "").trim();
        if (!key) continue;

        const value = formResponses[key];
        const hasValue = value !== undefined && value !== null && String(value).trim() !== "";

        if (field?.required && !hasValue) {
          return res.status(400).json({
            message: `Missing required field: ${field.label || key}`,
          });
        }

        if (!hasValue) continue;

        if (field.type === "number") {
          const asNum = Number(value);
          if (!Number.isFinite(asNum)) {
            return res.status(400).json({
              message: `Invalid number for field: ${field.label || key}`,
            });
          }
        }

        if (field.type === "select") {
          const options = Array.isArray(field.options) ? field.options.map(String) : [];
          if (options.length > 0 && !options.includes(String(value))) {
            return res.status(400).json({
              message: `Invalid option for field: ${field.label || key}`,
            });
          }
        }

        if (field.type === "checkbox") {
          const validBoolean =
            typeof value === "boolean" ||
            value === "true" ||
            value === "false" ||
            value === "1" ||
            value === "0";

          if (!validBoolean) {
            return res.status(400).json({
              message: `Invalid checkbox value for field: ${field.label || key}`,
            });
          }

          if (field?.required) {
            const checked = value === true || value === "true" || value === "1";
            if (!checked) {
              return res.status(400).json({
                message: `Required checkbox must be selected: ${field.label || key}`,
              });
            }
          }
        }

        if (field.type === "file") {
          const isValidObject =
            typeof value === "object" &&
            value !== null &&
            typeof value.name === "string" &&
            typeof value.dataUrl === "string" &&
            value.name.trim() &&
            value.dataUrl.trim();

          if (!isValidObject) {
            return res.status(400).json({
              message: `Invalid file value for field: ${field.label || key}`,
            });
          }
        }
      }
    }

    if (event.eventType === "merchandise") {
      const sel = req.body?.merchandiseSelection;
      const itemIndex = Number(sel?.itemIndex);
      const variantIndex = Number(sel?.variantIndex);
      const quantity = Number(sel?.quantity);

      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        return res.status(400).json({ message: "Invalid merchandise item selection" });
      }
      if (!Number.isInteger(variantIndex) || variantIndex < 0) {
        return res.status(400).json({ message: "Invalid merchandise variant selection" });
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      const items = Array.isArray(event.merchandiseItems) ? event.merchandiseItems : [];
      const item = items[itemIndex];
      const variant = item?.variants?.[variantIndex];

      if (!item || !variant) {
        return res.status(400).json({ message: "Selected merchandise option not found" });
      }

      merchandiseSelection = {
        itemIndex,
        variantIndex,
        quantity,
      };
    }

    /* ================= REGISTER ================= */

    const participantName = `${user.firstName || ""} ${user.lastName || ""}`.trim();

    const qrPayload = {
      eventId: String(event._id),
      eventTitle: event.title,
      participantId: String(user._id),
      participantEmail: user.email,
      issuedAt: new Date().toISOString(),
    };

    const { teamName, teamSize } = extractTeamMetadata(formResponses);

    const session = await mongoose.startSession();
    let registration;
    let ticket;
    let ticketId;
    let qrData;
    let qrDataUrl;
    let qrBuffer;

    try {
      await session.startTransaction();

      if (event.eventType === "merchandise") {
        const stockPath = `merchandiseItems.${merchandiseSelection.itemIndex}.variants.${merchandiseSelection.variantIndex}.stock`;
        const updated = await Event.findOneAndUpdate(
          {
            _id: event._id,
            [stockPath]: { $gte: merchandiseSelection.quantity },
          },
          {
            $inc: { [stockPath]: -merchandiseSelection.quantity },
          },
          { new: true, session }
        );

        if (!updated) {
          await session.abortTransaction();
          return res.status(400).json({
            message: "Insufficient stock for selected variant",
          });
        }
      }

      const created = await Registration.create(
        [
          {
            event: event._id,
            participant: req.user.id,
            status: "registered",
            formResponses,
            merchandiseSelection,
            teamName,
            teamSize,
          },
        ],
        { session }
      );

      registration = created[0];
      ticketId = `TKT-${registration._id}`;
      qrData = JSON.stringify({
        ...qrPayload,
        ticketId,
      });
      qrDataUrl = await QRCode.toDataURL(qrData);
      qrBuffer = await QRCode.toBuffer(qrData);

      const pdfBuffer = await buildTicketPdfBuffer({
        ticketId,
        eventTitle: event.title,
        eventType: event.eventType,
        startDate: event.startDate,
        endDate: event.endDate,
        participantName,
        participantEmail: user.email,
        qrDataUrl,
      });

      const pdfBase64 = pdfBuffer.toString("base64");
      const pdfUrl = `data:application/pdf;base64,${pdfBase64}`;

      ticket = await Ticket.create(
        [
          {
            registration: registration._id,
            event: event._id,
            participant: user._id,
            ticketId,
            qrData,
            qrDataUrl,
            pdfUrl,
            status: "active",
            emailStatus: "pending",
            emailError: null,
          },
        ],
        { session }
      );

      registration.ticket = ticket[0]._id;
      await registration.save({ session });

      await session.commitTransaction();
      ticket = ticket[0];
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    let emailStatus = "skipped";
    let emailError = null;
    if (isSmtpConfigured()) {
      const qrCid = `ticket-${ticket._id}`;
      const emailHtml = buildTicketEmailHtml({
        participantName,
        eventTitle: event.title,
        eventType: event.eventType,
        startDate: event.startDate,
        endDate: event.endDate,
        ticketId,
        qrCid,
      });

      const attemptAt = new Date();

      try {
        await sendEmail({
          to: user.email,
          subject: `Ticket Confirmation: ${event.title}`,
          html: emailHtml,
          attachments: [
            {
              filename: `ticket-${ticketId}.png`,
              content: qrBuffer,
              contentType: "image/png",
              cid: qrCid,
            },
          ],
        });

        emailStatus = "sent";
        await Ticket.updateOne(
          { _id: ticket._id },
          { $set: { emailStatus: "sent", emailedAt: attemptAt, lastEmailAttemptAt: attemptAt, emailError: null } }
        );
      } catch (err) {
        emailStatus = "failed";
        emailError = err.message || "Email send failed";
        await Ticket.updateOne(
          { _id: ticket._id },
          {
            $set: {
              emailStatus: "failed",
              emailError,
              lastEmailAttemptAt: attemptAt,
            },
          }
        );
      }
    } else {
      emailError = "SMTP is not configured";
    }

    return res.status(201).json({
      message: "Successfully registered for event",
      ticketId,
      qrDataUrl,
      ticketDbId: ticket._id,
      pdfUrl: ticket.pdfUrl,
      emailStatus,
      emailError,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Get events registered by logged-in participant
  @route   GET /api/registrations/my
  @access  Participant
*/
export const getMyRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find({
      participant: req.user.id,
      status: "registered",
    })
      .populate({
        path: "event",
        populate: {
          path: "organizer",
          select: "firstName lastName organizerName organizerCategory organizerContactEmail",
        },
      })
      .populate({
        path: "ticket",
        select: "ticketId qrDataUrl pdfUrl status",
      })
      .sort({ createdAt: -1 });

    res.status(200).json(registrations);
  } catch (error) {
    console.error("Get my registrations error:", error);
    res.status(500).json({
      message: "Server error while fetching registrations",
    });
  }
};

/*
  @desc    Download calendar for registered events
  @route   GET /api/registrations/my/calendar.ics
  @access  Participant
*/
export const getMyRegistrationsCalendarIcs = async (req, res) => {
  try {
    const registrations = await Registration.find({
      participant: req.user.id,
      status: "registered",
    }).populate({
      path: "event",
      select: "title description startDate endDate status organizer location",
    });

    const events = registrations.map((reg) => reg.event).filter(Boolean);
    const ics = buildCalendarIcs(events, { defaultLocation: "IIIT Hyderabad" });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=my-events.ics");
    return res.status(200).send(ics);
  } catch (error) {
    console.error("Calendar download error:", error);
    return res.status(500).json({
      message: "Server error while generating calendar",
    });
  }
};



/*
  @desc    Cancel (unregister) from an event
  @route   DELETE /api/registrations/:eventId
  @access  Participant
*/
export const cancelRegistration = async (req, res) => {
  try {
    const registration = await Registration.findOne({
      event: req.params.eventId,
      participant: req.user.id,
      status: "registered",
    });

    if (!registration) {
      return res.status(404).json({
        message: "Active registration not found",
      });
    }

    registration.status = "cancelled";
    await registration.save();

    // If this was a merchandise purchase, restore stock.
    if (registration.merchandiseSelection) {
      const { itemIndex, variantIndex, quantity } = registration.merchandiseSelection;
      const stockPath = `merchandiseItems.${itemIndex}.variants.${variantIndex}.stock`;
      await Event.updateOne(
        { _id: req.params.eventId },
        { $inc: { [stockPath]: Number(quantity) } }
      );
    }

    if (registration.ticket) {
      await Ticket.updateOne(
        { _id: registration.ticket },
        { $set: { status: "revoked", revokedAt: new Date() } }
      );
    }

    return res.status(200).json({
      message: "Successfully unregistered from event",
    });
  } catch (error) {
    console.error("Cancel registration error:", error);
    return res.status(500).json({
      message: "Server error while cancelling registration",
    });
  }
};

/*
  @desc    Get registered participants for an event
  @route   GET /api/registrations/event/:eventId
  @access  Organizer (owner) / Admin
*/
export const getEventParticipants = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }
    
    if (event.status === "draft") {
      return res.status(400).json({
        message: "Participants are available after the event is published",
      });
    }

    /* Ownership check */
    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You are not allowed to view registrations for this event",
      });
    }

    const registrations = await Registration.find({
      event: req.params.eventId,
      status: "registered",
    })
      .populate("participant", "firstName lastName email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      totalParticipants: registrations.length,
      participants: registrations.map((r) => r.participant),
      registrations: registrations.map((r) => ({
        id: r._id,
        participant: r.participant,
        registeredAt: r.createdAt,
        status: r.status,
        teamName: r.teamName || null,
        teamSize: Number(r.teamSize || 1),
        attended: Boolean(r.attended),
        attendedAt: r.attendedAt || null,
      })),
    });
  } catch (error) {
    console.error("Get event participants error:", error);
    return res.status(500).json({
      message: "Server error while fetching participants",
    });
  }
};

export const getUpcomingRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find({
      participant: req.user.id,
      status: "registered",
    })
      .populate({
        path: "event",
        match: { startDate: { $gte: new Date() } },
        populate: {
          path: "organizer",
          select: "firstName lastName organizerName organizerCategory organizerContactEmail",
        },
      })
      .populate({
        path: "ticket",
        select: "ticketId qrDataUrl pdfUrl status",
      });

    const upcoming = registrations.filter(r => r.event);
    res.json(upcoming);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


export const getPastRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find({
      participant: req.user.id,
      status: "registered",
    })
      .populate({
        path: "event",
        match: { endDate: { $lt: new Date() } },
        populate: {
          path: "organizer",
          select: "firstName lastName organizerName organizerCategory organizerContactEmail",
        },
      })
      .populate({
        path: "ticket",
        select: "ticketId qrDataUrl pdfUrl status",
      });

    const past = registrations.filter(r => r.event);
    res.json(past);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


export const getCancelledRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find({
      participant: req.user.id,
      status: "cancelled",
    }).populate({
      path: "event",
      populate: {
        path: "organizer",
        select: "firstName lastName organizerName organizerCategory organizerContactEmail",
      },
    })
      .populate({
        path: "ticket",
        select: "ticketId qrDataUrl pdfUrl status",
      });

    res.json(registrations);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Mark participant attendance for an event registration
  @route   PUT /api/registrations/event/:eventId/:registrationId/attendance
  @access  Organizer (owner) / Admin
*/
export const updateAttendance = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.status === "draft") {
      return res.status(400).json({
        message: "Attendance can be updated only after publishing the event",
      });
    }

    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You are not allowed to update attendance for this event",
      });
    }

    const registration = await Registration.findOne({
      _id: req.params.registrationId,
      event: req.params.eventId,
      status: "registered",
    }).populate("participant", "firstName lastName email");

    if (!registration) {
      return res.status(404).json({
        message: "Registration not found",
      });
    }

    const attended = Boolean(req.body?.attended);
    const reason = normalizeAttendanceReason(req.body?.reason);
    const currentAttended = Boolean(registration.attended);

    if (currentAttended !== attended) {
      registration.attended = attended;
      registration.attendedAt = attended ? new Date() : null;
      registration.attendanceAudit = Array.isArray(registration.attendanceAudit)
        ? registration.attendanceAudit
        : [];
      registration.attendanceAudit.push(
        buildAttendanceAuditEntry({
          actorId: req.user.id,
          actorRole: req.user.role,
          source: "manual",
          action: attended ? "MARK_PRESENT" : "MARK_ABSENT",
          reason,
        })
      );
      await registration.save();
    }

    return res.status(200).json({
      message:
        currentAttended === attended
          ? attended
            ? "Attendance already marked"
            : "Attendance already removed"
          : attended
            ? "Attendance marked"
            : "Attendance removed",
      registration: toAttendanceRegistrationPayload(registration),
    });
  } catch (error) {
    console.error("Update attendance error:", error);
    return res.status(500).json({
      message: "Server error while updating attendance",
    });
  }
};

/*
  @desc    Mark attendance by scanned QR payload
  @route   POST /api/registrations/event/:eventId/attendance/scan
  @access  Organizer (owner) / Admin
*/
export const updateAttendanceByScan = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.status === "draft") {
      return res.status(400).json({
        message: "Attendance can be updated only after publishing the event",
      });
    }

    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You are not allowed to update attendance for this event",
      });
    }

    const qrData = req.body?.qrData;
    if (typeof qrData !== "string" || !qrData.trim()) {
      return res.status(400).json({ message: "qrData is required" });
    }

    let parsedQr;
    try {
      parsedQr = JSON.parse(qrData);
    } catch {
      return res.status(400).json({ message: "Invalid QR data format" });
    }

    const qrTicketId = String(parsedQr?.ticketId || "").trim();
    const qrEventId = String(parsedQr?.eventId || "").trim();

    if (!qrTicketId || !qrEventId) {
      return res.status(400).json({
        message: "QR data must include ticketId and eventId",
      });
    }

    if (qrEventId !== String(req.params.eventId)) {
      return res.status(400).json({
        message: "Scanned QR does not belong to this event",
      });
    }

    const ticket = await Ticket.findOne({
      ticketId: qrTicketId,
      event: req.params.eventId,
    }).select("_id registration event status ticketId");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found for this event" });
    }

    if (ticket.status !== "active") {
      return res.status(400).json({ message: "Ticket is not active" });
    }

    const registration = await Registration.findOne({
      _id: ticket.registration,
      event: req.params.eventId,
      status: "registered",
    }).populate("participant", "firstName lastName email");

    if (!registration) {
      return res.status(404).json({
        message: "Active registration not found for scanned ticket",
      });
    }

    const now = new Date();
    const reason = normalizeAttendanceReason(req.body?.reason);
    const updatedRegistration = await Registration.findOneAndUpdate(
      {
        _id: registration._id,
        event: req.params.eventId,
        status: "registered",
        attended: false,
      },
      {
        $set: {
          attended: true,
          attendedAt: now,
        },
        $push: {
          attendanceAudit: buildAttendanceAuditEntry({
            actorId: req.user.id,
            actorRole: req.user.role,
            source: "qr_upload",
            action: "MARK_PRESENT",
            reason,
            ticketId: ticket.ticketId,
          }),
        },
      },
      { new: true }
    ).populate("participant", "firstName lastName email");

    if (!updatedRegistration) {
      const latest = await Registration.findById(registration._id).populate(
        "participant",
        "firstName lastName email"
      );

      if (latest?.status === "registered" && latest?.attended) {
        await Registration.updateOne(
          { _id: latest._id },
          {
            $push: {
              attendanceAudit: buildAttendanceAuditEntry({
                actorId: req.user.id,
                actorRole: req.user.role,
                source: "qr_upload",
                action: "DUPLICATE_SCAN",
                reason,
                ticketId: ticket.ticketId,
              }),
            },
          }
        );

        return res.status(409).json({
          message: "Duplicate scan: attendance already marked",
          duplicate: true,
          registration: toAttendanceRegistrationPayload(latest),
        });
      }

      return res.status(409).json({
        message: "Could not mark attendance due to a concurrent update",
      });
    }

    return res.status(200).json({
      message: "Attendance marked via QR scan",
      registration: toAttendanceRegistrationPayload(updatedRegistration),
      ticketId: ticket.ticketId,
    });
  } catch (error) {
    console.error("Update attendance by scan error:", error);
    return res.status(500).json({
      message: "Server error while processing scanned attendance",
    });
  }
};
