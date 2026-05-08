import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import ParticipantPasswordResetToken from "../models/ParticipantPasswordResetToken.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { isSmtpConfigured, sendEmail } from "../utils/mailer.js";
export const registerUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      participantType,
      collegeOrOrg,
      interests,
      organizerCategory,
      contactNumber,
    } = req.body;

    /* ================= BASIC VALIDATION ================= */

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: "Required fields are missing",
      });
    }

    /* ================= SELF-REGISTRATION ROLE RULE ================= */

    // As per assignment: only Participants can self-register.
    // Organizer accounts are provisioned by Admin; Admin has no UI registration.
    if (req.body.role && req.body.role !== "participant") {
      return res.status(403).json({
        message: "Only participants can self-register",
      });
    }

    /* ================= CHECK EXISTING USER ================= */

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists with this email",
      });
    }

    /* ================= PASSWORD HASHING ================= */

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    /* ================= PARTICIPANT TYPE AUTO-DETECTION ================= */

    const isIiitEmail = normalizedEmail.endsWith(".iiit.ac.in");

    const normalizedParticipantType =
      participantType === "IIIT" || participantType === "Non-IIIT"
        ? participantType
        : null;

    // If UI provides participantType, validate it. Otherwise, infer from email.
    let finalParticipantType = normalizedParticipantType;
    if (!finalParticipantType) {
      finalParticipantType = isIiitEmail ? "IIIT" : "Non-IIIT";
    }

    // Enforce IIIT domain validation when IIIT is selected.
    if (finalParticipantType === "IIIT" && !isIiitEmail) {
      return res.status(400).json({
        message: "IIIT participants must use an IIIT-issued email address",
      });
    }

    // Keep classification consistent: IIIT-issued emails must register as IIIT.
    if (finalParticipantType === "Non-IIIT" && isIiitEmail) {
      return res.status(400).json({
        message: "IIIT-issued email addresses must register as IIIT participants",
      });
    }

    /* ================= CREATE USER ================= */

    const user = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      password: hashedPassword,
      role: "participant",
      participantType: finalParticipantType,
      collegeOrOrg,
      interests,
      organizerCategory,
      contactNumber,
    });

    return res.status(201).json({
      message: "User registered successfully",
      userId: user._id,
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({
      message: "Server error during registration",
    });
  }
};
/*
  @desc    Login user
  @route   POST /api/auth/login
  @access  Public
*/
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    /* ================= BASIC VALIDATION ================= */

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    /* ================= FIND USER ================= */

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    /* ================= CHECK ACCOUNT STATUS ================= */

    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is blocked. Please contact admin.",
      });
    }

    /* ================= PASSWORD MATCH ================= */

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        role: user.role,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Server error during login",
    });
  }
};

/*
  @desc    Request password reset (participant self-service)
  @route   POST /api/auth/forgot-password
  @access  Public
*/
export const requestParticipantPasswordReset = async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || "").toLowerCase().trim();
    if (!rawEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!isSmtpConfigured()) {
      return res.status(500).json({ message: "SMTP is not configured" });
    }

    const user = await User.findOne({ email: rawEmail, role: "participant" });

    if (!user) {
      return res.json({
        message: "If an account exists, a reset link has been sent.",
      });
    }

    await ParticipantPasswordResetToken.deleteMany({
      user: user._id,
      usedAt: null,
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await ParticipantPasswordResetToken.create({
      user: user._id,
      email: user.email,
      tokenHash,
      expiresAt,
    });

    const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendBase}/reset-password?token=${rawToken}&email=${encodeURIComponent(
      user.email
    )}`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin-bottom: 8px;">Reset your password</h2>
        <p>We received a request to reset your password.</p>
        <p><a href="${resetLink}">Click here to reset your password</a></p>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: "Reset your Felicity password",
      html,
    });

    return res.json({
      message: "If an account exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Request password reset error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
  @desc    Reset password using token (participant self-service)
  @route   POST /api/auth/reset-password
  @access  Public
*/
export const resetParticipantPassword = async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || "").toLowerCase().trim();
    const token = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.newPassword || "");

    if (!rawEmail || !token || !newPassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findOne({ email: rawEmail, role: "participant" });
    if (!user) {
      return res.status(400).json({ message: "Invalid token or expired" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetToken = await ParticipantPasswordResetToken.findOne({
      user: user._id,
      tokenHash,
      usedAt: null,
    }).sort({ createdAt: -1 });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid token or expired" });
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    resetToken.usedAt = new Date();
    await resetToken.save();

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
