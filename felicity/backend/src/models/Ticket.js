import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
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
    ticketId: {
      type: String,
      required: true,
      index: true,
    },
    qrData: {
      type: String,
      required: true,
    },
    qrDataUrl: {
      type: String,
      required: true,
    },
    pdfUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    emailStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    emailError: {
      type: String,
      default: null,
    },
    emailedAt: {
      type: Date,
      default: null,
    },
    lastEmailAttemptAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Ticket", ticketSchema);
