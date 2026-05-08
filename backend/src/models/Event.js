import mongoose from "mongoose";

const registrationFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["text", "number", "select", "checkbox", "file", "textarea", "date"],
      default: "text",
    },
    required: { type: Boolean, default: false },
    options: [{ type: String, trim: true }],
  },
  { _id: false }
);

const merchandiseVariantSchema = new mongoose.Schema(
  {
    size: { type: String, default: null, trim: true },
    color: { type: String, default: null, trim: true },
    stock: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const merchandiseItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    itemPrice: { type: Number, default: 0, min: 0 },
    variants: {
      type: [merchandiseVariantSchema],
      default: [],
    },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    /* ================= BASIC EVENT INFO ================= */

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    venue: {
      type: String,
      default: null,
      trim: true,
    },

    totalPrizeMoney: {
      type: Number,
      default: 0,
      min: 0,
    },

    category: {
      type: String,
      enum: ["Technical", "Cultural", "Sports", "Other", "Merchandise"],
      required: true,
    },

    eventTags: [
      {
        type: String,
        trim: true,
      },
    ],

    /* ================= EVENT TYPE ================= */

    // As per PDF: Normal or Merchandise
    eventType: {
      type: String,
      enum: ["normal", "merchandise"],
      required: true,
    },

    // Individual or Team participation
    participationType: {
      type: String,
      enum: ["individual", "team"],
      required: true,
    },

    /* ================= ELIGIBILITY ================= */

    eligibility: {
      type: String,
      enum: ["IIIT", "Non-IIIT", "Both"],
      required: true,
    },

    /* ================= REGISTRATION DETAILS ================= */

    registrationDeadline: {
      type: Date,
      required: true,
    },

    registrationFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    registrationLimit: {
      type: Number,
      required: true,
      min: 1,
    },

    registrationsClosed: {
      type: Boolean,
      default: false,
    },

    /* ================= TYPE-SPECIFIC DETAILS ================= */

    // Normal events can define a custom registration form.
    registrationFormFields: {
      type: [registrationFieldSchema],
      default: [],
    },

    // Merchandise events define item details + variants/stock.
    merchandiseItems: {
      type: [merchandiseItemSchema],
      default: [],
    },

    /* ================= EVENT TIMING ================= */

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    /* ================= ORGANIZER ================= */

    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /* ================= STATUS ================= */

    status: {
      type: String,
      enum: ["draft", "published", "closed", "completed"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Event", eventSchema);
