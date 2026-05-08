import "dotenv/config";
import http from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import bootstrapAdmin from "./utils/bootstrapAdmin.js";
import Event from "./models/Event.js";
import Registration from "./models/Registration.js";

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Connect to MongoDB
  await connectDB();

  // Ensure the first admin user exists (backend-only provisioning)
  try {
    const result = await bootstrapAdmin();
    if (result?.created) {
      console.log(`Bootstrapped admin: ${result.email}`);
      if (result.usedGeneratedPassword && result.password) {
        console.log(`Generated admin password: ${result.password}`);
        console.log("Set ADMIN_PASSWORD in .env to control this.");
      }
    }
  } catch (err) {
    console.error("Admin bootstrap failed:", err.message || err);
    process.exit(1);
  }

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  app.set("io", io);

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("Unauthorized"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: payload.id, role: payload.role };
      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("event:join", async ({ eventId } = {}) => {
      try {
        if (!eventId) return;
        const event = await Event.findById(eventId).select("organizer");
        if (!event) return;

        const role = socket.user?.role;
        const userId = socket.user?.id;
        let allowed = false;

        if (role === "admin") {
          allowed = true;
        } else if (role === "organizer") {
          allowed = String(event.organizer) === String(userId);
        } else if (role === "participant") {
          const reg = await Registration.findOne({
            event: event._id,
            participant: userId,
            status: "registered",
          }).select("_id");
          allowed = Boolean(reg);
        }

        if (!allowed) return;
        socket.join(`event:${eventId}`);
      } catch (error) {
        // ignore join errors
      }
    });
  });

  // Start server
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start();
