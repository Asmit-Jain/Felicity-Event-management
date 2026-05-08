import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./EventList.css";
const getOrganizerName = (org) => {
  if (!org) return "-";
  return org.organizerName || `${org.firstName || ""} ${org.lastName || ""}`.trim() || "-";
};
const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};
export default function OrganizerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [organizer, setOrganizer] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const [orgRes, upRes, pastRes] = await Promise.all([
          api.get(`/users/organizers/${id}`),
          api.get(`/events/organizer/${id}`, { params: { type: "upcoming" } }),
          api.get(`/events/organizer/${id}`, { params: { type: "past" } }),
        ]);

          if (!active) return;
          setOrganizer(orgRes.data);
          setUpcoming(upRes.data || []);
          setPast(pastRes.data || []);
          setMessage("");
      } catch (e) {
          if (!active) return;
          setMessage(e.response?.data?.message || "Failed to load organizer");
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <div className="events-container">
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
      <h2 className="title">Organizer Details</h2>
      {message && <p>{message}</p>}
      {organizer && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 6 }}>{getOrganizerName(organizer)}</h3>
          <div>Category: {organizer.organizerCategory || "-"}</div>
          <div>{organizer.organizerDescription || ""}</div>
          <div>Contact: {organizer.organizerContactEmail || "-"}</div>
        </div>
      )}
      <h3>Upcoming Events</h3>
      <div className="events-grid">
        {upcoming.map((event) => (
          <div
            key={event._id}
            className="event-card"
            onClick={() => navigate(`/events/${event._id}`)}
          >
            <h3 className="event-title">{event.title}</h3>
            <div className="event-category">Type: {event.eventType}</div>
            <div className="event-description">
              Schedule: {formatDate(event.startDate)} - {formatDate(event.endDate)}
            </div>
          </div>
        ))}
        {upcoming.length === 0 && <p>No upcoming events.</p>}
      </div>

      <h3 style={{ marginTop: 20 }}>Past Events</h3>
      <div className="events-grid">
        {past.map((event) => (
          <div
            key={event._id}
            className="event-card"
            onClick={() => navigate(`/events/${event._id}`)}
          >
            <h3 className="event-title">{event.title}</h3>
            <div className="event-category">Type: {event.eventType}</div>
            <div className="event-description">
              Schedule: {formatDate(event.startDate)} - {formatDate(event.endDate)}
            </div>
          </div>
        ))}
        {past.length === 0 && <p>No past events.</p>}
      </div>
    </div>
  );
}
