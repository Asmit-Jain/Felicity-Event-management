import bcrypt from "bcryptjs";
import User from "../models/User.js";

const FIXED_ADMIN_EMAIL = "admin@iiit.ac.in";
const FIXED_ADMIN_PASSWORD = "admin123";

export default async function bootstrapAdmin() {
  const hashedPassword = await bcrypt.hash(FIXED_ADMIN_PASSWORD, 10);

  // Keep exactly one admin account in the system.
  await User.deleteMany({
    role: "admin",
    email: { $ne: FIXED_ADMIN_EMAIL },
  });

  let adminUser = await User.findOne({ email: FIXED_ADMIN_EMAIL });
  const created = !adminUser;

  if (!adminUser) {
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: FIXED_ADMIN_EMAIL,
      password: hashedPassword,
      role: "admin",
      participantType: null,
      collegeOrOrg: null,
      interests: [],
      organizerName: null,
      organizerCategory: null,
      organizerDescription: null,
      organizerContactEmail: null,
      contactNumber: null,
      avatar: "",
      followedOrganizers: [],
      isActive: true,
    });
  } else {
    adminUser.firstName = "Admin";
    adminUser.lastName = "User";
    adminUser.email = FIXED_ADMIN_EMAIL;
    adminUser.password = hashedPassword;
    adminUser.role = "admin";
    adminUser.isActive = true;
    adminUser.participantType = null;
    adminUser.collegeOrOrg = null;
    adminUser.interests = [];
    adminUser.organizerName = null;
    adminUser.organizerCategory = null;
    adminUser.organizerDescription = null;
    adminUser.organizerContactEmail = null;
    await adminUser.save();
  }

  return {
    created,
    email: FIXED_ADMIN_EMAIL,
  };
}
