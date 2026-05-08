import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function MyEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/events/my-events")
      .then(res => setEvents(res.data))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) =>
      `${event.title} ${event.category}`.toLowerCase().includes(query)
    );
  }, [events, search]);

  return (
    <div style={{ padding: "40px" }}>
      <h2>My Events</h2>

      <div style={{ maxWidth: 720, marginTop: 12 }}>
        <input
          type="text"
          placeholder="Search by title or category"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: 8, borderRadius: 8, marginBottom: 12 }}
        />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(200px, 2fr) repeat(3, minmax(120px, 1fr))",
            gap: 12,
            color: "#94a3b8",
            textTransform: "uppercase",
            fontSize: 12,
            letterSpacing: "0.4px",
            padding: "0 10px",
          }}
        >
          <span>Event</span>
          <span>Type</span>
          <span>Status</span>
          <span>Manage</span>
        </div>

        {filtered.map((event) => (
          <div
            key={event._id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(200px, 2fr) repeat(3, minmax(120px, 1fr))",
              gap: 12,
              alignItems: "center",
              padding: "12px 10px",
              border: "1px solid #1e293b",
              borderRadius: 12,
              background: "#020617",
            }}
          >
            <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{event.title}</span>
            <span style={{ color: "#94a3b8" }}>{event.eventType}</span>
            <span style={{ color: "#94a3b8" }}>{event.status}</span>
            <button
              type="button"
              onClick={() => navigate(`/events/${event._id}`)}
              style={{
                background: "#38bdf8",
                color: "#0f172a",
                border: "none",
                padding: "6px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Open
            </button>
          </div>
        ))}

        {filtered.length === 0 && <p>No events found.</p>}
      </div>
    </div>
  );
}
