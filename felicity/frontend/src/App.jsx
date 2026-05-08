import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import EventList from "./pages/EventList";
import EventDetails from "./pages/EventDetails";
import Dashboard from "./pages/Dashboard";
import MyEvents from "./pages/MyEvents";
import ProtectedRoute from "./routes/ProtectedRoute";
import MyRegistrations from "./pages/MyRegistrations";
import UpcomingEvents from "./pages/UpcomingEvents";
import PastEvents from "./pages/PastEvents";
import OngoingEvents from "./pages/OngoingEvents";
import Profile from "./pages/Profile";
import CreateEvent from "./pages/CreateEvent";
import Organizers from "./pages/Organizers";
import OrganizerDetails from "./pages/OrganizerDetails";
import AdminOrganizers from "./pages/AdminOrganizers";
import Onboarding from "./pages/Onboarding";
import PasswordRequests from "./pages/PasswordRequests";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <EventList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute>
              <EventDetails />
            </ProtectedRoute>
          }
        />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/onboarding"
          element={
            <ProtectedRoute allowedRoles={["participant"]}>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-events"
          element={
            <ProtectedRoute allowedRoles={["organizer", "admin"]}>
              <MyEvents />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-event"
          element={
            <ProtectedRoute allowedRoles={["organizer", "admin"]}>
              <CreateEvent />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-registrations"
          element={
            <ProtectedRoute allowedRoles={["participant"]}>
              <MyRegistrations />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upcoming-events"
          element={
            <ProtectedRoute allowedRoles={["participant"]}>
              <UpcomingEvents />
            </ProtectedRoute>
          }
        />

        <Route
          path="/past-events"
          element={
            <ProtectedRoute allowedRoles={["participant"]}>
              <PastEvents />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ongoing-events"
          element={
            <ProtectedRoute allowedRoles={["organizer"]}>
              <OngoingEvents />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizers"
          element={
            <ProtectedRoute allowedRoles={["participant"]}>
              <Organizers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizers/:id"
          element={
            <ProtectedRoute allowedRoles={["participant"]}>
              <OrganizerDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/organizers"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminOrganizers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/password-requests"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <PasswordRequests />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
