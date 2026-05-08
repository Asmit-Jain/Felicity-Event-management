import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import authorizeRoles from "../middleware/role.middleware.js";

const router = express.Router();

/* Any logged-in user */
router.get("/protected", authMiddleware, (req, res) => {
  res.json({
    message: "Authenticated user access",
    user: req.user,
  });
});

/* Only admin */
router.get(
  "/admin-only",
  authMiddleware,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({
      message: "Admin access granted",
    });
  }
);

/* Organizer or admin */
router.get(
  "/organizer-admin",
  authMiddleware,
  authorizeRoles("organizer", "admin"),
  (req, res) => {
    res.json({
      message: "Organizer/Admin access granted",
    });
  }
);

export default router;
