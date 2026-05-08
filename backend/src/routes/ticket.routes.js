import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import authorizeRoles from "../middleware/role.middleware.js";
import { getTicketById, downloadTicketPdf } from "../controllers/ticket.controller.js";

const router = express.Router();

router.get(
  "/:id",
  authMiddleware,
  authorizeRoles("participant", "admin"),
  getTicketById
);

router.get(
  "/:id/pdf",
  authMiddleware,
  authorizeRoles("participant", "admin"),
  downloadTicketPdf
);

export default router;
