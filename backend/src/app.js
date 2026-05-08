import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import testRoutes from "./routes/test.routes.js";
import eventRoutes from "./routes/event.routes.js";
import registrationRoutes from "./routes/registration.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import userRoutes from "./routes/user.routes.js";
import passwordRoutes from "./routes/password.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
const app = express();

/*
  Middleware
*/
app.use(cors());
app.use(express.json());

/*
  Health Check Route
*/
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/test", testRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api", passwordRoutes);
app.use("/api/tickets", ticketRoutes);

export default app;
