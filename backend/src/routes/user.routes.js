import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import authorizeRoles from "../middleware/role.middleware.js";
import {
	getMe,
	updateAvatar,
	updateMe,
	listOrganizers,
	getOrganizerDetails,
	followOrganizer,
	unfollowOrganizer,
	updateMyPassword,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);
router.put("/avatar", authMiddleware, updateAvatar);
router.put("/me/password", authMiddleware, updateMyPassword);

router.get(
	"/organizers",
	authMiddleware,
	authorizeRoles("participant"),
	listOrganizers
);

router.get(
	"/organizers/:id",
	authMiddleware,
	authorizeRoles("participant"),
	getOrganizerDetails
);

router.put(
	"/follow/:organizerId",
	authMiddleware,
	authorizeRoles("participant"),
	followOrganizer
);

router.put(
	"/unfollow/:organizerId",
	authMiddleware,
	authorizeRoles("participant"),
	unfollowOrganizer
);

export default router;
