import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import User from "../models/User.js";
import { buildEventIcs } from "../utils/calendar.js";

const ALLOWED_FORM_FIELD_TYPES = [
  "text",
  "number",
  "select",
  "checkbox",
  "file",
  "textarea",
  "date",
];

const DEADLINE_MIN_GAP_MS = 60 * 60 * 1000;

const getLifecycleState = (event) => {
  if (!event) return "draft";
  if (event.status === "draft") return "draft";
  if (event.status === "closed") return "closed";
  if (event.status === "completed") return "completed";

  const now = new Date();
  const start = new Date(event.startDate);

  if (now < start) return "published";
  return "ongoing";
};
/*
  @desc    Create a new event (Draft or Published)
  @route   POST /api/events
  @access  Organizer/Admin
*/
export const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      venue,
      totalPrizeMoney,
      category,
      eventType,            // normal | merchandise
      participationType,    // individual | team
      eligibility,
      eventTags,
      registrationFormFields,
      merchandiseItems,
      registrationDeadline,
      registrationFee,
      registrationLimit,
      startDate,
      endDate,
      status,               // optional (draft by default)
    } = req.body;

    /* ================= BASIC REQUIRED FIELDS ================= */

    if (
      !title ||
      !description ||
      !category ||
      !eventType ||
      !participationType ||
      !eligibility ||
      !registrationDeadline ||
      !registrationLimit ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    /* ================= EVENT TYPE RULES ================= */

    // As per assignment excerpt: Normal and Merchandise events are individual-only.
    if (participationType !== "individual") {
      return res.status(400).json({
        message: "Only individual participation is allowed for this event type",
      });
    }

    /* ================= TYPE-SPECIFIC VALIDATION ================= */

    const normalizedFormFields = Array.isArray(registrationFormFields)
      ? registrationFormFields
      : [];
    const normalizedMerchItems = Array.isArray(merchandiseItems)
      ? merchandiseItems
      : [];

    if (eventType === "normal") {
      // Support dynamic/custom registration forms (can be empty).
      const seenKeys = new Set();
      for (const f of normalizedFormFields) {
        const key = String(f?.key || "").trim();
        const label = String(f?.label || "").trim();
        const type = f?.type || "text";
        if (!key || !label) {
          return res.status(400).json({
            message: "Each registration form field must have key and label",
          });
        }
        if (seenKeys.has(key)) {
          return res.status(400).json({
            message: "Registration form field keys must be unique",
          });
        }
        seenKeys.add(key);
        if (!ALLOWED_FORM_FIELD_TYPES.includes(type)) {
          return res.status(400).json({
            message: "Invalid registration form field type",
          });
        }
        if (type === "select") {
          const options = Array.isArray(f?.options) ? f.options : [];
          if (options.length === 0) {
            return res.status(400).json({
              message: "Select fields must include non-empty options",
            });
          }
        }
      }
    }

    if (eventType === "merchandise") {
      // Merchandise events must define item variants and stock.
      if (normalizedMerchItems.length === 0) {
        return res.status(400).json({
          message: "Merchandise events must include at least one item",
        });
      }
      for (const item of normalizedMerchItems) {
        const name = String(item?.name || "").trim();
        if (!name) {
          return res.status(400).json({
            message: "Merchandise item name is required",
          });
        }
        const itemPrice = Number(item?.itemPrice);
        if (!Number.isFinite(itemPrice) || itemPrice < 0) {
          return res.status(400).json({
            message: "Merchandise item price must be a non-negative number",
          });
        }
        const variants = Array.isArray(item?.variants) ? item.variants : [];
        if (variants.length === 0) {
          return res.status(400).json({
            message: "Merchandise items must include at least one variant",
          });
        }
        for (const v of variants) {
          const stock = Number(v?.stock);
          if (!Number.isFinite(stock) || stock < 0) {
            return res.status(400).json({
              message: "Merchandise variant stock must be a non-negative number",
            });
          }
        }
      }
    }

    /* ================= DATE VALIDATIONS ================= */

    const regDeadline = new Date(registrationDeadline);
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return res.status(400).json({
        message: "End date must be after start date",
      });
    }

    const latestAllowedDeadline = new Date(start.getTime() - DEADLINE_MIN_GAP_MS);
    if (regDeadline > latestAllowedDeadline) {
      return res.status(400).json({
        message: "Registration deadline must be at least 1 hour before event start time",
      });
    }

    if (registrationLimit <= 0) {
      return res.status(400).json({
        message: "Registration limit must be greater than zero",
      });
    }

    const normalizedVenue =
      venue === undefined || venue === null ? null : String(venue).trim();
    if (normalizedVenue === "") {
      return res.status(400).json({
        message: "Venue cannot be empty",
      });
    }

    const normalizedPrizeMoney =
      totalPrizeMoney === undefined || totalPrizeMoney === null
        ? 0
        : Number(totalPrizeMoney);
    if (!Number.isFinite(normalizedPrizeMoney) || normalizedPrizeMoney < 0) {
      return res.status(400).json({
        message: "Total prize money must be a non-negative number",
      });
    }

    /* ================= CREATE EVENT ================= */

    const event = await Event.create({
      title,
      description,
      venue: normalizedVenue,
      totalPrizeMoney: normalizedPrizeMoney,
      category,
      eventType,
      participationType,
      eligibility,
      eventTags,
      registrationFormFields: Array.isArray(registrationFormFields)
        ? registrationFormFields
        : [],
      merchandiseItems: Array.isArray(merchandiseItems) ? merchandiseItems : [],
      registrationDeadline,
      registrationFee: registrationFee || 0,
      registrationLimit,
      startDate,
      endDate,
      status: status || "draft",
      organizer: req.user.id,
    });

    return res.status(201).json({
      message: "Event created successfully",
      eventId: event._id,
      status: event.status,
    });
  } catch (error) {
    console.error("Create event error:", error);
    return res.status(500).json({
      message: "Server error while creating event",
    });
  }
};

/*
  @desc    Update a draft event
  @route   PUT /api/events/:id
  @access  Organizer (owner) / Admin
*/
export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    /* ================= AUTHORIZATION ================= */

    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You are not allowed to update this event",
      });
    }

    const lifecycle = getLifecycleState(event);

    if (lifecycle === "published") {
      const allowedPublishedUpdates = [
        "description",
        "registrationDeadline",
        "registrationLimit",
        "venue",
        "totalPrizeMoney",
      ];

      const incomingKeys = Object.keys(req.body || {});
      const disallowed = incomingKeys.filter(
        (key) => !allowedPublishedUpdates.includes(key)
      );

      if (disallowed.length > 0) {
        return res.status(400).json({
          message:
            "Only description, venue, total prize money, registration deadline, and registration limit can be updated for published events",
        });
      }

      if (req.body.description !== undefined) {
        const nextDescription = String(req.body.description || "").trim();
        if (!nextDescription) {
          return res.status(400).json({
            message: "Description cannot be empty",
          });
        }
        event.description = nextDescription;
      }

      if (req.body.registrationDeadline !== undefined) {
        const nextDeadline = new Date(req.body.registrationDeadline);
        const currentDeadline = new Date(event.registrationDeadline);
        const startDate = new Date(event.startDate);

        if (
          Number.isNaN(nextDeadline.getTime()) ||
          nextDeadline <= currentDeadline
        ) {
          return res.status(400).json({
            message: "Registration deadline can only be extended",
          });
        }

        const latestAllowedDeadline = new Date(
          startDate.getTime() - DEADLINE_MIN_GAP_MS
        );
        if (nextDeadline > latestAllowedDeadline) {
          return res.status(400).json({
            message:
              "Registration deadline must be at least 1 hour before event start time",
          });
        }

        event.registrationDeadline = nextDeadline;
      }

      if (req.body.registrationLimit !== undefined) {
        const nextLimit = Number(req.body.registrationLimit);
        const currentLimit = Number(event.registrationLimit);
        if (!Number.isFinite(nextLimit) || nextLimit <= currentLimit) {
          return res.status(400).json({
            message: "Registration limit can only be increased",
          });
        }
        event.registrationLimit = nextLimit;
      }

      if (req.body.venue !== undefined) {
        const nextVenue =
          req.body.venue === null ? null : String(req.body.venue || "").trim();
        if (nextVenue === "") {
          return res.status(400).json({
            message: "Venue cannot be empty",
          });
        }
        event.venue = nextVenue;
      }

      if (req.body.totalPrizeMoney !== undefined) {
        const nextPrizeMoney = Number(req.body.totalPrizeMoney);
        if (!Number.isFinite(nextPrizeMoney) || nextPrizeMoney < 0) {
          return res.status(400).json({
            message: "Total prize money must be a non-negative number",
          });
        }
        event.totalPrizeMoney = nextPrizeMoney;
      }

      await event.save();

      return res.status(200).json({
        message: "Published event updated successfully",
        eventId: event._id,
      });
    }

    if (lifecycle === "ongoing" || lifecycle === "closed" || lifecycle === "completed") {
      return res.status(400).json({
        message: "This event can no longer be edited. Use status actions instead",
      });
    }

    if (req.body.registrationFormFields !== undefined) {
      const registrationsCount = await Registration.countDocuments({
        event: event._id,
        status: "registered",
      });

      if (registrationsCount > 0) {
        const incomingFields = Array.isArray(req.body.registrationFormFields)
          ? req.body.registrationFormFields
          : [];
        const currentFields = Array.isArray(event.registrationFormFields)
          ? event.registrationFormFields
          : [];

        if (JSON.stringify(incomingFields) !== JSON.stringify(currentFields)) {
          return res.status(400).json({
            message:
              "Registration form is locked after first registration",
          });
        }
      }
    }

    /* ================= UPDATE FIELDS ================= */

    const allowedUpdates = [
      "title",
      "description",
      "venue",
      "totalPrizeMoney",
      "category",
      "eventType",
      "participationType",
      "eligibility",
      "eventTags",
      "registrationFormFields",
      "merchandiseItems",
      "registrationDeadline",
      "registrationFee",
      "registrationLimit",
      "startDate",
      "endDate",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    });

    if (req.body.venue !== undefined) {
      const normalizedVenue =
        req.body.venue === null ? null : String(req.body.venue || "").trim();
      if (normalizedVenue === "") {
        return res.status(400).json({
          message: "Venue cannot be empty",
        });
      }
      event.venue = normalizedVenue;
    }

    if (req.body.totalPrizeMoney !== undefined) {
      const normalizedPrizeMoney = Number(req.body.totalPrizeMoney);
      if (!Number.isFinite(normalizedPrizeMoney) || normalizedPrizeMoney < 0) {
        return res.status(400).json({
          message: "Total prize money must be a non-negative number",
        });
      }
      event.totalPrizeMoney = normalizedPrizeMoney;
    }

    /* ================= EVENT TYPE RULES ================= */

    // Enforce individual-only participation.
    if (event.participationType !== "individual") {
      return res.status(400).json({
        message: "Only individual participation is allowed for this event type",
      });
    }

    // Type-specific checks (same rules as create)
    if (event.eventType === "normal") {
      const fields = Array.isArray(event.registrationFormFields)
        ? event.registrationFormFields
        : [];
      const seenKeys = new Set();
      for (const f of fields) {
        const key = String(f?.key || "").trim();
        const label = String(f?.label || "").trim();
        const type = f?.type || "text";
        if (!key || !label) {
          return res.status(400).json({
            message: "Each registration form field must have key and label",
          });
        }
        if (seenKeys.has(key)) {
          return res.status(400).json({
            message: "Registration form field keys must be unique",
          });
        }
        seenKeys.add(key);
        if (!ALLOWED_FORM_FIELD_TYPES.includes(type)) {
          return res.status(400).json({
            message: "Invalid registration form field type",
          });
        }
        if (type === "select") {
          const options = Array.isArray(f?.options) ? f.options : [];
          if (options.length === 0) {
            return res.status(400).json({
              message: "Select fields must include non-empty options",
            });
          }
        }
      }
    }

    if (event.eventType === "merchandise") {
      const items = Array.isArray(event.merchandiseItems)
        ? event.merchandiseItems
        : [];
      if (items.length === 0) {
        return res.status(400).json({
          message: "Merchandise events must include at least one item",
        });
      }
      for (const item of items) {
        const name = String(item?.name || "").trim();
        if (!name) {
          return res.status(400).json({
            message: "Merchandise item name is required",
          });
        }
        const itemPrice = Number(item?.itemPrice);
        if (!Number.isFinite(itemPrice) || itemPrice < 0) {
          return res.status(400).json({
            message: "Merchandise item price must be a non-negative number",
          });
        }
        const variants = Array.isArray(item?.variants) ? item.variants : [];
        if (variants.length === 0) {
          return res.status(400).json({
            message: "Merchandise items must include at least one variant",
          });
        }
        for (const v of variants) {
          const stock = Number(v?.stock);
          if (!Number.isFinite(stock) || stock < 0) {
            return res.status(400).json({
              message: "Merchandise variant stock must be a non-negative number",
            });
          }
        }
      }
    }

    await event.save();

    return res.status(200).json({
      message: "Event updated successfully",
      eventId: event._id,
    });
  } catch (error) {
    console.error("Update event error:", error);
    return res.status(500).json({
      message: "Server error while updating event",
    });
  }
};

/*
  @desc    Delete a draft event
  @route   DELETE /api/events/:id
  @access  Organizer (owner) / Admin
*/
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    /* ================= AUTHORIZATION ================= */

    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You are not allowed to delete this event",
      });
    }

    /* ================= STATUS CHECK ================= */

    if (event.status === "published") {
      return res.status(400).json({
        message: "Published events cannot be deleted",
      });
    }

    await event.deleteOne();

    return res.status(200).json({
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Delete event error:", error);
    return res.status(500).json({
      message: "Server error while deleting event",
    });
  }
};

/*
  @desc    Publish an event
  @route   PUT /api/events/:id/publish
  @access  Organizer (owner) / Admin
*/
export const publishEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You are not allowed to publish this event",
      });
    }

    if (event.status !== "draft") {
      return res.status(400).json({
        message: "Only draft events can be published",
      });
    }

    // Enforce required type-specific data before publishing.
    if (event.eventType === "merchandise") {
      const items = Array.isArray(event.merchandiseItems)
        ? event.merchandiseItems
        : [];
      if (items.length === 0 || items.some((it) => !it?.variants || it.variants.length === 0)) {
        return res.status(400).json({
          message: "Merchandise events must define items with variants and stock before publishing",
        });
      }
      if (items.some((it) => !Number.isFinite(Number(it?.itemPrice)) || Number(it?.itemPrice) < 0)) {
        return res.status(400).json({
          message: "Merchandise items must include a valid non-negative item price before publishing",
        });
      }
    }

    event.status = "published";
    event.registrationsClosed = false;
    await event.save();

    res.json({
      message: "Event published successfully",
    });
  } catch (error) {
    console.error("Publish event error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Close registrations for a published/ongoing event
  @route   PUT /api/events/:id/close-registrations
  @access  Organizer (owner) / Admin
*/
export const closeRegistrations = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You are not allowed to update this event",
      });
    }

    const lifecycle = getLifecycleState(event);
    if (lifecycle === "draft" || lifecycle === "closed" || lifecycle === "completed") {
      return res.status(400).json({
        message: "Registrations can only be closed for published or ongoing events",
      });
    }

    if (event.registrationsClosed) {
      return res.status(400).json({
        message: "Registrations are already closed",
      });
    }

    event.registrationsClosed = true;
    await event.save();

    return res.status(200).json({
      message: "Registrations closed successfully",
      eventId: event._id,
    });
  } catch (error) {
    console.error("Close registrations error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Close an event
  @route   PUT /api/events/:id/close
  @access  Organizer (owner) / Admin
*/
export const closeEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You are not allowed to close this event",
      });
    }

    if (event.status === "draft") {
      return res.status(400).json({
        message: "Draft events cannot be closed",
      });
    }

    if (event.status === "closed") {
      return res.status(400).json({
        message: "Event is already closed",
      });
    }

    event.status = "closed";
    event.registrationsClosed = true;
    await event.save();

    return res.status(200).json({
      message: "Event closed successfully",
      eventId: event._id,
    });
  } catch (error) {
    console.error("Close event error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Mark an event as completed
  @route   PUT /api/events/:id/complete
  @access  Organizer (owner) / Admin
*/
export const completeEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You are not allowed to complete this event",
      });
    }

    if (event.status === "draft") {
      return res.status(400).json({
        message: "Draft events cannot be completed",
      });
    }

    if (event.status === "completed") {
      return res.status(400).json({
        message: "Event is already completed",
      });
    }

    event.status = "completed";
    event.registrationsClosed = true;
    await event.save();

    return res.status(200).json({
      message: "Event marked as completed",
      eventId: event._id,
    });
  } catch (error) {
    console.error("Complete event error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Get all published events (upcoming / past)
  @route   GET /api/events
  @access  Public
*/
export const getPublishedEvents = async (req, res) => {
  try {
    const { type } = req.query;
    const now = new Date();

    let filter = { status: "published" };

    if (type === "upcoming") {
      filter.startDate = { $gte: now };
    }

    if (type === "past") {
      filter.endDate = { $lt: now };
    }

    const events = await Event.find(filter)
      .populate("organizer", "firstName lastName email")
      .sort({ startDate: 1 });

    // Preference-driven ordering for participants (recommendations via sorting)
    // If request is authenticated as a participant, prioritize:
    // - events from followed organizers
    // - events whose category matches participant interests
    if (req.user?.id && req.user?.role === "participant") {
      const me = await User.findById(req.user.id).select("interests followedOrganizers");
      const interestSet = new Set((me?.interests || []).map(String));
      const followedSet = new Set((me?.followedOrganizers || []).map((x) => String(x)));

      const scored = events
        .map((e) => {
          const organizerId = String(e.organizer?._id || e.organizer);
          const scoreFromFollow = followedSet.has(organizerId) ? 3 : 0;
          const scoreFromInterest = interestSet.has(String(e.category)) ? 2 : 0;
          return {
            event: e,
            score: scoreFromFollow + scoreFromInterest,
          };
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(a.event.startDate) - new Date(b.event.startDate);
        })
        .map((x) => x.event);

      return res.json(scored);
    }

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


/*
  @desc    Get single event details
  @route   GET /api/events/:id
  @access  Public
*/

export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("organizer", "firstName lastName organizerName organizerCategory organizerContactEmail");

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Allow organizers/admins to view drafts, block others.
    if (event.status === "draft") {
      const organizerId = String(event.organizer?._id || event.organizer);
      const isOwner = organizerId === req.user?.id;
      const isAdmin = req.user?.role === "admin";
      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          message: "Event not available",
        });
      }
    }

    const registrationCount = await Registration.countDocuments({
      event: event._id,
      status: "registered",
    });

    res.json({
      ...event.toObject(),
      registrationCount,
      isFormLocked: registrationCount > 0,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Download event calendar file
  @route   GET /api/events/:id/calendar.ics
  @access  Authenticated
*/
export const getEventCalendarIcs = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select(
      "title description startDate endDate status organizer"
    );

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.status === "draft") {
      const organizerId = String(event.organizer);
      const isOwner = organizerId === req.user?.id;
      const isAdmin = req.user?.role === "admin";
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Event not available" });
      }
    }

    const slugBase = String(event?.title || "event")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const filename = `${slugBase || "event"}-event.ics`;
    const ics = buildEventIcs(event, { defaultLocation: "IIIT Hyderabad" });
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    return res.status(200).send(ics);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Get published events for an organizer (participant view)
  @route   GET /api/events/organizer/:organizerId
  @access  Participant
*/
export const getOrganizerEvents = async (req, res) => {
  try {
    const { type } = req.query;
    const now = new Date();

    const filter = {
      status: "published",
      organizer: req.params.organizerId,
    };

    if (type === "past") {
      filter.endDate = { $lt: now };
    } else if (type === "upcoming") {
      filter.startDate = { $gte: now };
    }

    const events = await Event.find(filter)
      .populate("organizer", "firstName lastName organizerName organizerCategory organizerContactEmail")
      .sort({ startDate: 1 });

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Get events created by logged-in organizer
  @route   GET /api/events/my-events
  @access  Organizer/Admin
*/
export const getMyEvents = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


/*  
  @desc  Browse events
*/ 
export const browseEvents = async (req, res) => {
  try {
    const {
      q,
      eventType,
      eligibility,
      startDate,
      endDate,
      followedOnly,
    } = req.query;

    const filter = { status: "published" };

    const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const buildFuzzyRegex = (value) => {
      const escaped = escapeRegex(value);
      if (!escaped) return null;
      const fuzzy = escaped.split("").join(".*");
      return new RegExp(fuzzy, "i");
    };

    /* Search by title, description, tags */
    if (q) {
      const textRegex = new RegExp(escapeRegex(q), "i");
      const fuzzyRegex = buildFuzzyRegex(q);
      const textOr = [
        { title: { $regex: textRegex } },
        { description: { $regex: textRegex } },
        { eventTags: { $in: [textRegex] } },
      ];

      if (fuzzyRegex) {
        textOr.push({ title: { $regex: fuzzyRegex } });
        textOr.push({ description: { $regex: fuzzyRegex } });
      }

      const organizerMatches = await User.find({
        role: "organizer",
        $or: [
          { organizerName: { $regex: textRegex } },
          { firstName: { $regex: textRegex } },
          { lastName: { $regex: textRegex } },
        ],
      }).select("_id");

      if (organizerMatches.length > 0) {
        textOr.push({ organizer: { $in: organizerMatches.map((o) => o._id) } });
      }

      filter.$or = textOr;
    }

    /* Filter by event type */
    if (eventType) {
      filter.eventType = eventType;
    }

    /* Filter by eligibility */
    if (eligibility) {
      filter.eligibility = { $in: [eligibility, "Both"] };
    }

    /* Date range filter */
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    /* Followed organizers filter */
    const followedFlag = String(followedOnly || "").toLowerCase();
    if (followedFlag === "true" || followedFlag === "1") {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (req.user.role !== "participant") {
        return res.status(403).json({ message: "Only participants can use this filter" });
      }

      const me = await User.findById(req.user.id).select("followedOrganizers");
      const followed = (me?.followedOrganizers || []).map((id) => id.toString());
      filter.organizer = { $in: followed };
    }

    const events = await Event.find(filter)
      .populate("organizer", "firstName lastName organizerName organizerCategory organizerContactEmail")
      .sort({ startDate: 1 });

    res.json(events);
  } catch (error) {
    console.error("Browse events error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/*  
  @desc  Get Trending events
*/ 

export const getTrendingEvents = async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trending = await Registration.aggregate([
      { $match: { status: "registered", createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$event",
          registrations: { $sum: 1 },
        },
      },
      { $sort: { registrations: -1 } },
      { $limit: 5 },
    ]);

    const eventIds = trending.map(t => t._id);

    const events = await Event.find({
      _id: { $in: eventIds },
      status: "published",
    }).populate("organizer", "firstName lastName organizerName organizerCategory organizerContactEmail");

    const eventMap = new Map(events.map((e) => [String(e._id), e]));
    const ordered = eventIds.map((id) => eventMap.get(String(id))).filter(Boolean);

    res.json(ordered);
  } catch (error) {
    console.error("Trending events error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getEventAnalytics = async (req, res) => {
  try {
    const eventId = req.params.id;

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (req.user.role !== "admin" && !event.organizer.equals(req.user.id)) {
      return res.status(403).json({
        message: "Not authorized to view analytics",
      });
    }
    const totalRegistrations = await Registration.countDocuments({
      event: eventId,
    });

    const activeRegistrations = await Registration.countDocuments({
      event: eventId,
      status: "registered",
    });

    const cancelledRegistrations = await Registration.countDocuments({
      event: eventId,
      status: "cancelled",
    });

    const attendedRegistrations = await Registration.countDocuments({
      event: eventId,
      status: "registered",
      attended: true,
    });

    const registrationsWithTeamData = await Registration.countDocuments({
      event: eventId,
      status: "registered",
      teamName: { $nin: [null, ""] },
    });

    const teamCompletionRate =
      event.participationType === "individual"
        ? 100
        : activeRegistrations > 0
          ? Math.round((registrationsWithTeamData / activeRegistrations) * 100)
          : 0;

    let totalRevenue = 0;

    if (event.eventType === "merchandise") {
      const sales = await Registration.find({
        event: eventId,
        status: "registered",
        merchandiseSelection: { $ne: null },
      }).select("merchandiseSelection");

      totalRevenue = sales.reduce((sum, registration) => {
        const itemIndex = Number(registration?.merchandiseSelection?.itemIndex);
        const quantity = Number(registration?.merchandiseSelection?.quantity || 0);
        const item = event?.merchandiseItems?.[itemIndex];
        const itemPrice = Number(item?.itemPrice || 0);

        if (!Number.isFinite(quantity) || quantity <= 0) return sum;
        if (!Number.isFinite(itemPrice) || itemPrice < 0) return sum;

        return sum + itemPrice * quantity;
      }, 0);
    } else {
      const fee = Number(event.registrationFee || 0);
      totalRevenue = Number.isFinite(fee) && fee > 0 ? activeRegistrations * fee : 0;
    }

    res.json({
      eventId,
      totalRegistrations,
      activeRegistrations,
      cancelledRegistrations,
      attendedRegistrations,
      teamCompletionRate,
      totalRevenue,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
  
};


export const getMyEventsAnalytics = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id });

    const analytics = [];

    for (const event of events) {
      const total = await Registration.countDocuments({ event: event._id });
      const active = await Registration.countDocuments({
        event: event._id,
        status: "registered",
      });

      const attended = await Registration.countDocuments({
        event: event._id,
        status: "registered",
        attended: true,
      });

      analytics.push({
        eventId: event._id,
        title: event.title,
        totalRegistrations: total,
        activeRegistrations: active,
        attendedRegistrations: attended,
      });
    }

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
