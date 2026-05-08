import mongoose from "mongoose";

const eventMessageReadSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

eventMessageReadSchema.index({ event: 1, user: 1 }, { unique: true });
eventMessageReadSchema.index({ user: 1, lastReadAt: -1 });

export default mongoose.model("EventMessageRead", eventMessageReadSchema);