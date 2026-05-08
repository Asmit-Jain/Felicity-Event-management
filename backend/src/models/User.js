import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: function requiredLastName() {
        return this.role === "participant";
      },
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["participant", "organizer", "admin"],
      required: true,
    },
    participantType: {
      type: String,
      enum: ["IIIT", "Non-IIIT"],
      default: null,
    },

    collegeOrOrg: {
      type: String,
      default: null,
    },

    interests: {
      type: [
        {
          type: String,
          enum: ["Technical", "Cultural", "Sports", "Other"],
        },
      ],
      default: [],
    },

    organizerName: {
      type: String,
      default: null,
      trim: true,
    },

    organizerCategory: {
      type: String,
      enum: ["Technical", "Cultural", "Sports", "Other"],
      default: null,
    },

    organizerDescription: {
      type: String,
      default: null,
      trim: true,
    },

    organizerContactEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },

    contactNumber: {
      type: String,
      default: null,
    },

    avatar: {
      type: String,
      default: "",
    },


    followedOrganizers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
