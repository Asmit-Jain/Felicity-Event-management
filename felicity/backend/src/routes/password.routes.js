import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import authorizeRoles from "../middleware/role.middleware.js";
import {
  createPasswordResetRequest,
  listPasswordResetRequests,
  completePasswordResetRequest,
  rejectPasswordResetRequest,
  listOrganizerPasswordResetHistory,
} from "../controllers/password.controller.js";

const router = express.Router();

router.post(
  "/password-resets",
  authMiddleware,
  authorizeRoles("organizer"),
  createPasswordResetRequest
);

router.get(
  "/admin/password-requests",
  authMiddleware,
  authorizeRoles("admin"),
  listPasswordResetRequests
);

router.put(
  "/admin/password-requests/:id/complete",
  authMiddleware,
  authorizeRoles("admin"),
  completePasswordResetRequest
);

router.put(
  "/admin/password-requests/:id/reject",
  authMiddleware,
  authorizeRoles("admin"),
  rejectPasswordResetRequest
);

router.get(
  "/admin/organizers/:id/password-resets",
  authMiddleware,
  authorizeRoles("admin"),
  listOrganizerPasswordResetHistory
);

export default router;
