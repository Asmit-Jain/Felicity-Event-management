import "./Dashboard.css";
import { getUserRole } from "../utils/auth";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

export default function Dashboard() {
  const role = getUserRole(); 
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState([]);
  const [registered, setRegistered] = useState([]);
  const [past, setPast] = useState([]);
  const [cancelled, setCancelled] = useState([]);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("normal");
  const [section, setSection] = useState("upcoming");
  const [organizerEvents, setOrganizerEvents] = useState([]);
  const [organizerAnalytics, setOrganizerAnalytics] = useState([]);
  const [organizerMessage, setOrganizerMessage] = useState("");

  useEffect(() => {
    if (role !== "participant") return;
    let active = true;

    const run = async () => {
      try {
        const [upRes, regRes, pastRes, cancelledRes] = await Promise.all([
          api.get("/registrations/upcoming"),
          api.get("/registrations/my"),
          api.get("/registrations/past"),
          api.get("/registrations/cancelled"),
        ]);
        if (!active) return;
        setUpcoming(upRes.data || []);
        setRegistered(regRes.data || []);
        setPast(pastRes.data || []);
        setCancelled(cancelledRes.data || []);
        setMessage("");
      } catch (e) {
        if (!active) return;
        setMessage(e.response?.data?.message || "Failed to load dashboard data");
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (role !== "organizer") return;
    let active = true;

    const run = async () => {
      try {
        const [eventsRes, analyticsRes] = await Promise.all([
          api.get("/events/my-events"),
          api.get("/events/my-events/analytics"),
        ]);
        if (!active) return;
        setOrganizerEvents(eventsRes.data || []);
        setOrganizerAnalytics(analyticsRes.data || []);
        setOrganizerMessage("");
      } catch (e) {
        if (!active) return;
        setOrganizerMessage(e.response?.data?.message || "Failed to load organizer data");
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [role]);

  const normalRegs = useMemo(
    () => registered.filter((r) => r.event?.eventType === "normal"),
    [registered]
  );
  const merchRegs = useMemo(
    () => registered.filter((r) => r.event?.eventType === "merchandise"),
    [registered]
  );

  const tabData = {
    normal: normalRegs,
    merchandise: merchRegs,
    completed: past,
    cancelled: cancelled,
  };

  const items = tabData[tab] || [];

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  const getOrganizerName = (event) => {
    const org = event?.organizer;
    if (!org) return "-";
    return org.organizerName || `${org.firstName || ""} ${org.lastName || ""}`.trim() || "-";
  };

  const getEventStatus = (event) => {
    if (!event) return "Draft";
    if (event.status === "draft") return "Draft";
    if (event.status === "closed") return "Closed";
    if (event.status === "completed") return "Completed";
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    if (now < start) return "Published";
    if (now > end) return "Closed";
    return "Ongoing";
  };

  const analyticsById = useMemo(
    () => new Map((organizerAnalytics || []).map((a) => [String(a.eventId), a])),
    [organizerAnalytics]
  );

  const completedAnalytics = useMemo(() => {
    const now = new Date();
    return (organizerEvents || [])
      .filter((event) => event && new Date(event.endDate) < now)
      .map((event) => {
        const analytics = analyticsById.get(String(event._id)) || {};
        const total = Number(analytics.totalRegistrations || 0);
        const active = Number(analytics.activeRegistrations || 0);
        const fee = Number(event.registrationFee || 0);
        return {
          eventId: event._id,
          title: event.title,
          totalRegistrations: total,
          sales: active,
          revenue: active * fee,
          attendance: Number(analytics.attendedRegistrations || 0),
        };
      });
  }, [organizerEvents, analyticsById]);


  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Dashboard</h1>

      {role === "participant" && (
        <div>
          {message && <p>{message}</p>}

          <div className="card-grid">
            <DashboardCard
              title="Upcoming Events"
              description="Your registered upcoming events"
              active={section === "upcoming"}
              onClick={() => setSection("upcoming")}
            />
            <DashboardCard
              title="Participation History"
              description="Normal, merchandise, completed, cancelled"
              active={section === "history"}
              onClick={() => setSection("history")}
            />
            <DashboardCard
              title="Event Records"
              description="Ticket IDs and participation status"
              active={section === "records"}
              onClick={() => setSection("records")}
            />
          </div>

          {section === "upcoming" && (
            <div className="participant-section">
              <h2 className="section-title">Upcoming Registered Events</h2>
              <p className="section-subtitle">
                Event name, type, organizer, and schedule.
              </p>
              <div className="card-grid">
                {upcoming.map((reg) => (
                  <div
                    key={reg._id}
                    className="dashboard-card info-card"
                    onClick={() => navigate(`/events/${reg.event?._id}`)}
                  >
                    <h3>{reg.event?.title || "Event"}</h3>
                    <p>Type: {reg.event?.eventType}</p>
                    <p>Organizer: {getOrganizerName(reg.event)}</p>
                    <p>
                      Schedule: {formatDate(reg.event?.startDate)} - {formatDate(reg.event?.endDate)}
                    </p>
                  </div>
                ))}
                {upcoming.length === 0 && <p>No upcoming registrations.</p>}
              </div>
            </div>
          )}

          {section === "history" && (
            <div className="participant-section">
              <h2 className="section-title">Participation History</h2>
              <p className="section-subtitle">
                View your records by category.
              </p>
              <div className="history-tabs">
                <button onClick={() => setTab("normal")} className={tab === "normal" ? "active" : ""}>
                  Normal
                </button>
                <button
                  onClick={() => setTab("merchandise")}
                  className={tab === "merchandise" ? "active" : ""}
                >
                  Merchandise
                </button>
                <button
                  onClick={() => setTab("completed")}
                  className={tab === "completed" ? "active" : ""}
                >
                  Completed
                </button>
                <button
                  onClick={() => setTab("cancelled")}
                  className={tab === "cancelled" ? "active" : ""}
                >
                  Cancelled / Rejected
                </button>
                <button onClick={() => navigate("/my-registrations")}>
                  Open Full History
                </button>
              </div>

              <div className="card-grid" style={{ marginTop: 12 }}>
                {items.map((reg) => (
                  <div
                    key={reg._id}
                    className="dashboard-card info-card"
                    onClick={() => navigate(`/events/${reg.event?._id}`)}
                  >
                    <h3>{reg.event?.title || "Event"}</h3>
                    <p>Status: {reg.status || "registered"}</p>
                    <p>Organizer: {getOrganizerName(reg.event)}</p>
                    <p>
                      Schedule: {formatDate(reg.event?.startDate)} - {formatDate(reg.event?.endDate)}
                    </p>
                  </div>
                ))}
                {items.length === 0 && <p>No records in this tab.</p>}
              </div>
            </div>
          )}

          {section === "records" && (
            <div className="participant-section">
              <h2 className="section-title">Event Records</h2>
              <p className="section-subtitle">
                Ticket IDs and participation status.
              </p>

              <div className="card-grid">
                {[...registered, ...past, ...cancelled]
                  .filter((r, idx, arr) => arr.findIndex((x) => x._id === r._id) === idx)
                  .map((reg) => (
                    <div key={reg._id} className="dashboard-card info-card">
                      <h3>{reg.event?.title || "Event"}</h3>
                      <p>Type: {reg.event?.eventType}</p>
                      <p>Organizer: {getOrganizerName(reg.event)}</p>
                      <p>Status: {reg.status || "registered"}</p>
                      <p>Team: -</p>
                      <button
                        type="button"
                        className="ticket-link"
                        onClick={() => navigate(`/events/${reg.event?._id}`)}
                      >
                        Ticket ID: {reg._id}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {role === "organizer" && (
        <div className="organizer-dashboard">
          {organizerMessage && <p>{organizerMessage}</p>}

          <section className="organizer-section">
            <div className="section-header">
              <h2>Events Carousel</h2>
            </div>

            <div className="organizer-carousel">
              {(organizerEvents || []).map((event) => {
                const statusLabel = getEventStatus(event);
                const statusClass = statusLabel.toLowerCase();
                const isDraft = statusLabel === "Draft";

                return (
                  <div key={event._id} className="organizer-card">
                    <div className="organizer-card-header">
                      <h3>{event.title}</h3>
                      <span className={`status-tag status-${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p>Type: {event.eventType}</p>
                    <p>
                      Schedule: {formatDate(event.startDate)} - {formatDate(event.endDate)}
                    </p>
                    <button
                      type="button"
                      className="organizer-card-action"
                      onClick={() => navigate(`/events/${event._id}`)}
                    >
                      {isDraft ? "Edit Draft" : "View Details"}
                    </button>
                  </div>
                );
              })}

              {organizerEvents.length === 0 && (
                <div className="organizer-empty">No events created yet.</div>
              )}
            </div>
          </section>

          <section className="organizer-section">
            <div className="section-header">
              <h2>Event Analytics</h2>
            </div>

            <div className="organizer-table">
              <div className="organizer-table-header">
                <span>Event</span>
                <span>Registrations</span>
                <span>Sales</span>
                <span>Revenue</span>
                <span>Attendance</span>
              </div>

              {completedAnalytics.map((row) => (
                <div key={row.eventId} className="organizer-table-row">
                  <span className="organizer-row-title">{row.title}</span>
                  <span>{row.totalRegistrations}</span>
                  <span>{row.sales}</span>
                  <span>INR {row.revenue}</span>
                  <span>{row.attendance}</span>
                </div>
              ))}

              {completedAnalytics.length === 0 && (
                <div className="organizer-empty">No completed events yet.</div>
              )}
            </div>
          </section>

        </div>
      )}

      {role === "admin" && (
        <div className="card-grid">
          <DashboardCard
            title="Manage Organizers"
            description="Block / unblock organizers"
            onClick={() => navigate("/admin/organizers")}
          />
          <DashboardCard
            title="Password Reset Requests"
            description="Review and complete reset requests"
            onClick={() => navigate("/admin/password-requests")}
          />
        </div>
      )}
    </div>
  );
}

function DashboardCard({ title, description, onClick, active }) {
  return (
    <div className={`dashboard-card ${active ? "active" : ""}`} onClick={onClick}>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
