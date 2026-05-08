import User from "../models/User.js";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import { comparePassword, hashPassword } from "../utils/password.js";

const splitOrganizerName = (value) => {
  const normalized = String(value || "").trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  return {
    organizerName: normalized,
    firstName: parts[0] || "",
    lastName: parts[1] || "",
  };
};

const buildMeResponse = async (userId) => {
  const user = await User.findById(userId).select(
    [
      "firstName",
      "lastName",
      "email",
      "role",
      "avatar",
      "createdAt",
      "participantType",
      "collegeOrOrg",
      "contactNumber",
      "interests",
      "followedOrganizers",
      "organizerName",
      "organizerCategory",
      "organizerDescription",
      "organizerContactEmail",
      "isActive",
    ].join(" ")
  );

  if (!user) return null;

  let registrationCount = 0;
  let activeRegistrationCount = 0;
  let eventCount = 0;

  if (user.role === "participant") {
    registrationCount = await Registration.countDocuments({
      participant: user._id,
    });

    activeRegistrationCount = await Registration.countDocuments({
      participant: user._id,
      $or: [{ status: "registered" }, { status: { $exists: false } }],
    });
  }

  if (user.role === "organizer") {
    eventCount = await Event.countDocuments({
      organizer: user._id,
    });
  }

  const payload = {
    ...user.toObject(),
    registrationCount,
    activeRegistrationCount,
    eventCount,
  };

  // Display-only compatibility: older organizer accounts used lastName="Club".
  // Do not mutate DB; just normalize response for UI.
  if (payload.role === "organizer" && payload.organizerName) {
    payload.lastName = "";
  }

  return payload;
};

/*
  @desc    Get logged-in user profile
  @route   GET /api/users/me
  @access  Private
*/
export const getMe = async (req, res) => {
  try {
    const payload = await buildMeResponse(req.user.id);
    if (!payload) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
};

/*
  @desc    Update user avatar
  @route   PUT /api/users/avatar
  @access  Private
*/
export const updateAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    user.avatar = req.body.avatar; // 🔥 REQUIRED
    await user.save();

    const payload = await buildMeResponse(req.user.id);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: "Failed to update avatar" });
  }
};

/*
  @desc    Update logged-in user profile (participant/organizer)
  @route   PUT /api/users/me
  @access  Private
*/
export const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "participant") {
      const allowed = [
        "firstName",
        "lastName",
        "contactNumber",
        "collegeOrOrg",
        "interests",
        "followedOrganizers",
      ];

      for (const key of allowed) {
        if (req.body[key] !== undefined) user[key] = req.body[key];
      }
    }

    if (user.role === "organizer") {
      if (req.body.organizerName !== undefined) {
        const split = splitOrganizerName(req.body.organizerName);
        user.organizerName = split.organizerName;
        user.firstName = split.firstName;
        user.lastName = split.lastName;
      }
      if (req.body.organizerCategory !== undefined) user.organizerCategory = req.body.organizerCategory;
      if (req.body.organizerDescription !== undefined) user.organizerDescription = req.body.organizerDescription;
      if (req.body.organizerContactEmail !== undefined) user.organizerContactEmail = req.body.organizerContactEmail;
      if (req.body.contactNumber !== undefined) user.contactNumber = req.body.contactNumber;
    }

    await user.save();
    const payload = await buildMeResponse(req.user.id);
    res.json(payload);
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

/*
  @desc    List all approved organizers (participant view)
  @route   GET /api/users/organizers
  @access  Participant
*/
export const listOrganizers = async (req, res) => {
  try {
    const organizers = await User.find({ role: "organizer", isActive: true })
      .select(
        "organizerName firstName lastName organizerCategory organizerDescription organizerContactEmail"
      )
      .sort({ organizerName: 1, firstName: 1 });

    res.json(organizers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch organizers" });
  }
};

/*
  @desc    Get organizer details (participant view)
  @route   GET /api/users/organizers/:id
  @access  Participant
*/
export const getOrganizerDetails = async (req, res) => {
  try {
    const organizer = await User.findOne({
      _id: req.params.id,
      role: "organizer",
      isActive: true,
    }).select(
      "organizerName firstName lastName organizerCategory organizerDescription organizerContactEmail"
    );

    if (!organizer) {
      return res.status(404).json({ message: "Organizer not found" });
    }

    res.json(organizer);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch organizer" });
  }
};

/*
  @desc    Follow an organizer
  @route   PUT /api/users/follow/:organizerId
  @access  Participant
*/
export const followOrganizer = async (req, res) => {
  try {
    const organizer = await User.findById(req.params.organizerId);
    if (!organizer || organizer.role !== "organizer" || !organizer.isActive) {
      return res.status(404).json({ message: "Organizer not found" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.followedOrganizers.some((id) => id.toString() === organizer._id.toString())) {
      user.followedOrganizers.push(organizer._id);
      await user.save();
    }

    const payload = await buildMeResponse(req.user.id);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: "Failed to follow organizer" });
  }
};

/*
  @desc    Unfollow an organizer
  @route   PUT /api/users/unfollow/:organizerId
  @access  Participant
*/
export const unfollowOrganizer = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.followedOrganizers = (user.followedOrganizers || []).filter(
      (id) => id.toString() !== req.params.organizerId
    );

    await user.save();
    const payload = await buildMeResponse(req.user.id);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: "Failed to unfollow organizer" });
  }
};

/*
  @desc    Update password for logged-in user
  @route   PUT /api/users/me/password
  @access  Private (participant)
*/
export const updateMyPassword = async (req, res) => {
  try {
    if (req.user.role !== "participant") {
      return res.status(403).json({ message: "Only participants can change password here" });
    }

    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const matches = await comparePassword(currentPassword, user.password);
    if (!matches) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    return res.json({ message: "Password updated" });
  } catch (error) {
    console.error("Update password error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
