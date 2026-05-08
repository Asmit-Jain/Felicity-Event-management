import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./EventList.css";

const getOrganizerName = (event) => {
  const org = event?.organizer;
  if (!org) return "-";
  return org.organizerName || `${org.firstName || ""} ${org.lastName || ""}`.trim() || "-";
};

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

export default function PastEvents() {
  const [registrations, setRegistrations] = useState([]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const res = await api.get("/registrations/past");
        if (!active) return;
        setRegistrations(res.data || []);
        setMessage("");
      } catch (e) {
        if (!active) return;
        setMessage(e.response?.data?.message || "Failed to load past registrations");
      }
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="events-container">
      <h2 className="title">Past Registered Events</h2>
      {message && <p>{message}</p>}

      <div className="events-grid">
        {registrations.map((reg) => (
          <div
            key={reg._id}
            className="event-card"
            onClick={() => navigate(`/events/${reg.event?._id}`)}
          >
            <h3 className="event-title">{reg.event?.title || "Event"}</h3>
            <div className="event-category">Type: {reg.event?.eventType}</div>
            <div className="event-description">Organizer: {getOrganizerName(reg.event)}</div>
            <div className="event-description">
              Schedule: {formatDate(reg.event?.startDate)} - {formatDate(reg.event?.endDate)}
            </div>
          </div>
        ))}

        {registrations.length === 0 && <p>No past registrations.</p>}
      </div>
    </div>
  );
}
