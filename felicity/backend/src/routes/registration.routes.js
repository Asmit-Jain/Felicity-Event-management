import express from "express";
import { registerForEvent, getMyRegistrations, cancelRegistration, 
         getEventParticipants, getUpcomingRegistrations, getPastRegistrations,
         getCancelledRegistrations, getMyRegistrationsCalendarIcs,
         updateAttendance, updateAttendanceByScan } from "../controllers/registration.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import authorizeRoles from "../middleware/role.middleware.js";

const router = express.Router();

router.get(
  "/my",
  authMiddleware,
  authorizeRoles("participant"),
  getMyRegistrations
);

router.get(
  "/my/calendar.ics",
  authMiddleware,
  authorizeRoles("participant"),
  getMyRegistrationsCalendarIcs
);

router.get(
  "/event/:eventId",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  getEventParticipants
);

router.put(
  "/event/:eventId/:registrationId/attendance",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  updateAttendance
);

router.post(
  "/event/:eventId/attendance/scan",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  updateAttendanceByScan
);

router.delete(
  "/:eventId",
  authMiddleware,
  authorizeRoles("participant"),
  cancelRegistration
);

router.post(
  "/:eventId",
  authMiddleware,
  authorizeRoles("participant"),
  registerForEvent
);

/* Upcoming registered events */
router.get(
  "/upcoming",
  authMiddleware,
  authorizeRoles("participant"),
  getUpcomingRegistrations
);

/* Past registered events */
router.get(
  "/past",
  authMiddleware,
  authorizeRoles("participant"),
  getPastRegistrations
);

/* Cancelled registrations */
router.get(
  "/cancelled",
  authMiddleware,
  authorizeRoles("participant"),
  getCancelledRegistrations
);

export default router;
