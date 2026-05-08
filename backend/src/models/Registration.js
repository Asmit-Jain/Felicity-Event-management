import mongoose from "mongoose";

const merchandiseSelectionSchema = new mongoose.Schema(
  {
    itemIndex: { type: Number, required: true, min: 0 },
    variantIndex: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const attendanceAuditEntrySchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      default: Date.now,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorRole: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ["qr_upload", "manual"],
      required: true,
    },
    action: {
      type: String,
      enum: ["MARK_PRESENT", "MARK_ABSENT", "DUPLICATE_SCAN"],
      required: true,
    },
    reason: {
      type: String,
      default: null,
      trim: true,
    },
    meta: {
      ticketId: {
        type: String,
        default: null,
        trim: true,
      },
    },
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    participant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["registered", "cancelled"],
      default: "registered",
    },

    attended: {
      type: Boolean,
      default: false,
    },

    attendedAt: {
      type: Date,
      default: null,
    },

    attendanceAudit: {
      type: [attendanceAuditEntrySchema],
      default: [],
    },

    // Dynamic registration form responses (Normal events)
    formResponses: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Optional team metadata captured from registration responses.
    teamName: {
      type: String,
      default: null,
      trim: true,
    },

    teamSize: {
      type: Number,
      default: 1,
      min: 1,
    },

    // Merchandise purchase selection (Merchandise events)
    merchandiseSelection: {
      type: merchandiseSelectionSchema,
      default: null,
    },

    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Registration ||
  mongoose.model("Registration", registrationSchema);
