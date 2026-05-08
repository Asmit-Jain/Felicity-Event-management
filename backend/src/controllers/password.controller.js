import crypto from "crypto";
import PasswordResetRequest from "../models/PasswordResetRequest.js";
import User from "../models/User.js";
import { hashPassword } from "../utils/password.js";

const generateTempPassword = () => {
  return crypto
    .randomBytes(9)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12);
};

/*
  @desc    Create a password reset request
  @route   POST /api/password-resets
  @access  Participant/Organizer
*/
export const createPasswordResetRequest = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "organizer") {
      return res.status(403).json({
        message: "Participants must use the self-service reset flow",
      });
    }

    const existing = await PasswordResetRequest.findOne({
      user: user._id,
      status: "pending",
    });

    if (existing) {
      return res.status(409).json({ message: "A pending request already exists" });
    }

    const reason = req.body?.reason ? String(req.body.reason).trim() : null;
    const isOrganizer = user.role === "organizer";
    const clubName = isOrganizer
      ? String(user.organizerName || "").trim() || null
      : null;

    const request = await PasswordResetRequest.create({
      user: user._id,
      organizer: isOrganizer ? user._id : null,
      role: user.role,
      clubName,
      reason,
      email: user.email,
      status: "pending",
    });

    return res.status(201).json({
      message: "Password reset request created",
      requestId: request._id,
    });
  } catch (error) {
    console.error("Create password reset request error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    List pending password reset requests
  @route   GET /api/admin/password-requests
  @access  Admin
*/
export const listPasswordResetRequests = async (req, res) => {
  try {
    const roleFilter = req.query?.role ? String(req.query.role) : null;
    const filter = {};
    if (roleFilter) {
      filter.role = roleFilter;
    }

    const requests = await PasswordResetRequest.find(filter)
      .populate("user", "email role")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error("List password reset requests error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Complete a password reset request
  @route   PUT /api/admin/password-requests/:id/complete
  @access  Admin
*/
export const completePasswordResetRequest = async (req, res) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id);

    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Pending request not found" });
    }

    const user = await User.findById(request.user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const plainPassword = generateTempPassword();

    user.password = await hashPassword(plainPassword);
    await user.save();

    request.status = "approved";
    request.handledAt = new Date();
    request.handledBy = req.user.id;
    if (req.body?.adminComment || req.body?.note) {
      request.adminComment = String(req.body.adminComment || req.body.note);
    }
    await request.save();

    return res.json({
      message: "Password reset completed",
      email: user.email,
      password: plainPassword,
      newPasswordPlain: plainPassword,
      organizer: {
        id: user._id,
        email: user.email,
        clubName: request.clubName || null,
      },
    });
  } catch (error) {
    console.error("Complete password reset request error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Reject a password reset request
  @route   PUT /api/admin/password-requests/:id/reject
  @access  Admin
*/
export const rejectPasswordResetRequest = async (req, res) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id);

    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Pending request not found" });
    }

    request.status = "rejected";
    request.handledAt = new Date();
    request.handledBy = req.user.id;
    request.adminComment = req.body?.adminComment
      ? String(req.body.adminComment)
      : req.body?.note
      ? String(req.body.note)
      : null;
    await request.save();

    return res.json({ message: "Password reset request rejected" });
  } catch (error) {
    console.error("Reject password reset request error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    List password reset history for organizer
  @route   GET /api/admin/organizers/:id/password-resets
  @access  Admin
*/
export const listOrganizerPasswordResetHistory = async (req, res) => {
  try {
    const organizerId = req.params.id;

    const requests = await PasswordResetRequest.find({
      user: organizerId,
      role: "organizer",
    })
      .sort({ createdAt: -1 })
      .select(
        "clubName role reason status adminComment createdAt handledAt handledBy"
      );

    res.json(requests);
  } catch (error) {
    console.error("List organizer password history error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
