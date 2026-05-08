import express from "express";
import {
  registerUser,
  loginUser,
  requestParticipantPasswordReset,
  resetParticipantPassword,
} from "../controllers/auth.controller.js";

const router = express.Router();

/*
  @route   POST /api/auth/register
  @desc    Register a new user
  @access  Public
*/
router.post("/register", registerUser);

/*
  @route   POST /api/auth/login
  @desc    Login user
  @access  Public
*/
router.post("/login", loginUser);

/* Participant self-service reset */
router.post("/forgot-password", requestParticipantPasswordReset);
router.post("/reset-password", resetParticipantPassword);

export default router;
