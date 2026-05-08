import express from "express";
import { createEvent, publishEvent, 
  getPublishedEvents, getMyEvents, 
  updateEvent, deleteEvent, browseEvents,
  getTrendingEvents, getEventAnalytics,
  getMyEventsAnalytics, getEventById,
  getOrganizerEvents, closeEvent,
  completeEvent, closeRegistrations,
  getEventCalendarIcs } from "../controllers/event.controller.js";
import {
  getEventMessages,
  createEventMessage,
  pinEventMessage,
  unpinEventMessage,
  deleteEventMessage,
  reactToEventMessage,
  getUnreadMessageSummary,
  markEventMessagesRead,
} from "../controllers/eventMessage.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import authorizeRoles from "../middleware/role.middleware.js";

const router = express.Router();

/* Create Event */
router.post(
  "/",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  createEvent
);

/* Public */
router.get("/", authMiddleware, getPublishedEvents);

/* Update Draft Event */
router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  updateEvent
);

/* Delete Draft Event */
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  deleteEvent
);

/* Publish Event */
router.put(
  "/:id/publish",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  publishEvent
);

router.put(
  "/:id/close-registrations",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  closeRegistrations
);

router.put(
  "/:id/close",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  closeEvent
);

router.put(
  "/:id/complete",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  completeEvent
);

/* All events analytics */
router.get(
  "/my-events/analytics",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  getMyEventsAnalytics
);

/* Organizer/Admin */
router.get(
  "/my-events",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  getMyEvents
);

/* Participant organizer events */
router.get(
  "/organizer/:organizerId",
  authMiddleware,
  authorizeRoles("participant"),
  getOrganizerEvents
);

/* Public browse/trending (must be above /:id) */
router.get("/browse", authMiddleware, browseEvents);
router.get("/trending", authMiddleware, getTrendingEvents);
router.get("/messages/unread-summary", authMiddleware, getUnreadMessageSummary);

router.get("/:id/messages", authMiddleware, getEventMessages);
router.post("/:id/messages", authMiddleware, createEventMessage);
router.post("/:id/messages/read", authMiddleware, markEventMessagesRead);
router.put(
  "/:id/messages/:messageId/pin",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  pinEventMessage
);
router.put(
  "/:id/messages/:messageId/unpin",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  unpinEventMessage
);
router.delete(
  "/:id/messages/:messageId",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  deleteEventMessage
);
router.post(
  "/:id/messages/:messageId/react",
  authMiddleware,
  reactToEventMessage
);

router.get("/:id/calendar.ics", authMiddleware, getEventCalendarIcs);

router.get("/:id", authMiddleware, getEventById);

/* Single event analytics */
router.get(
  "/:id/analytics",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  getEventAnalytics
);
export default router;
