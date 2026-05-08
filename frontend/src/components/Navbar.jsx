import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";
import { removeToken } from "../utils/auth";
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem("user");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    api
      .get("/users/me")
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("user", JSON.stringify(res.data));
      })
      .catch(() => setUser(null));

    const onUserUpdated = () => {
      try {
        const cached = localStorage.getItem("user");
        if (cached) setUser(JSON.parse(cached));
      } catch {
        // ignore
      }
    };

    window.addEventListener("user-updated", onUserUpdated);
    return () => window.removeEventListener("user-updated", onUserUpdated);
  }, [location.pathname]);

  const handleLogout = () => {
    removeToken();
    localStorage.removeItem("user");
    setUser(null);
    window.dispatchEvent(new Event("user-updated"));
    navigate("/login");
  };

  const getInitials = (name) => {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "ME";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const displayName =
    user?.role === "organizer"
      ? user?.organizerName || user?.firstName || ""
      : `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  const initials = getInitials(displayName);
  const isParticipant = user?.role === "participant";
  const isOrganizer = user?.role === "organizer";
  const isAdmin = user?.role === "admin";

  return (
    <nav className="navbar">
      <h1 className="logo" onClick={() => navigate("/")}>Felicity</h1>

      <div className="nav-links">
        {isParticipant && (
          <>
            <Link to="/">Browse Events</Link>
            <Link to="/dashboard">Dashboard</Link>
          </>
        )}

        {isParticipant && (
          <Link to="/organizers">Clubs/Organizers</Link>
        )}

        {isOrganizer && (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/create-event">Create Event</Link>
            <Link to="/ongoing-events">Ongoing Events</Link>
          </>
        )}

        {isAdmin && (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/admin/organizers">Manage Organizers</Link>
            <Link to="/admin/password-requests">Password Reset Requests</Link>
          </>
        )}

        {!user && (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}

        {user && !isAdmin && (
          <div
            className="avatar-circle"
            onClick={() => navigate("/profile")}
            title="Profile"
          >
            {user.avatar ? (
              <img
                src={`/avatars/${user.avatar}`}
                alt="avatar"
                style={{ width: "100%", height: "100%", borderRadius: "50%" }}
              />
            ) : (
              initials
            )}
          </div>
        )}

        {user && (
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
