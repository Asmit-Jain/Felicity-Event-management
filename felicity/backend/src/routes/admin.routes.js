import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import authorizeRoles from "../middleware/role.middleware.js";
import {
  createOrganizer,
  listOrganizers,
  updateOrganizer,
  disableOrganizer,
  enableOrganizer,
  archiveOrganizer,
  deleteOrganizer,
  resendTicketEmail,
} from "../controllers/admin.controller.js";

const router = express.Router();

/* Create organizer (admin-provisioned) */
router.post(
  "/organizers",
  authMiddleware,
  authorizeRoles("admin"),
  createOrganizer
);

router.get(
  "/organizers",
  authMiddleware,
  authorizeRoles("admin"),
  listOrganizers
);

router.put(
  "/organizers/:id",
  authMiddleware,
  authorizeRoles("admin"),
  updateOrganizer
);

router.put(
  "/organizers/:id/disable",
  authMiddleware,
  authorizeRoles("admin"),
  disableOrganizer
);

router.put(
  "/organizers/:id/enable",
  authMiddleware,
  authorizeRoles("admin"),
  enableOrganizer
);

router.put(
  "/organizers/:id/archive",
  authMiddleware,
  authorizeRoles("admin"),
  archiveOrganizer
);

router.delete(
  "/organizers/:id",
  authMiddleware,
  authorizeRoles("admin"),
  deleteOrganizer
);

router.put(
  "/tickets/:id/resend",
  authMiddleware,
  authorizeRoles("admin"),
  resendTicketEmail
);

export default router;
