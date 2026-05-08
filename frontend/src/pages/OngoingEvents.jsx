import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./EventList.css";

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
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

export default function OngoingEvents() {
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const res = await api.get("/events/my-events");
        if (!active) return;
        setEvents(res.data || []);
        setMessage("");
      } catch (e) {
        if (!active) return;
        setMessage(e.response?.data?.message || "Failed to load ongoing events");
      }
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  const ongoingEvents = useMemo(() => {
    const now = new Date();
    return (events || []).filter((event) => {
      if (!event) return false;
      if (event.status !== "published") return false;
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      return start <= now && now <= end;
    });
  }, [events]);

  return (
    <div className="events-container">
      <h2 className="title">Ongoing Events</h2>
      {message && <p>{message}</p>}

      <div className="events-grid">
        {ongoingEvents.map((event) => (
          <div key={event._id} className="event-card">
            <h3 className="event-title">{event.title}</h3>
            <div className="event-category">Type: {event.eventType}</div>
            <div className="event-description">Status: {getEventStatus(event)}</div>
            <div className="event-description">
              Schedule: {formatDate(event.startDate)} - {formatDate(event.endDate)}
            </div>
            <div style={{ marginTop: "14px" }}>
              <button onClick={() => navigate(`/events/${event._id}`)}>View Details</button>
            </div>
          </div>
        ))}

        {ongoingEvents.length === 0 && <p>No ongoing events found.</p>}
      </div>
    </div>
  );
}
