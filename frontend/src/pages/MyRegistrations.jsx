import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./EventList.css";

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const getOrganizerName = (event) => {
  const org = event?.organizer;
  if (!org) return "-";
  return org.organizerName || `${org.firstName || ""} ${org.lastName || ""}`.trim() || "-";
};

export default function MyRegistrations() {
  const [registered, setRegistered] = useState([]);
  const [past, setPast] = useState([]);
  const [cancelled, setCancelled] = useState([]);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("normal");
  const navigate = useNavigate();
  const calendarUrl = `${api.defaults.baseURL}/registrations/my/calendar.ics`;

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const [regRes, pastRes, cancelledRes] = await Promise.all([
          api.get("/registrations/my"),
          api.get("/registrations/past"),
          api.get("/registrations/cancelled"),
        ]);
        if (!active) return;
        setRegistered(regRes.data || []);
        setPast(pastRes.data || []);
        setCancelled(cancelledRes.data || []);
        setMessage("");
      } catch (e) {
        if (!active) return;
        setMessage(e.response?.data?.message || "Failed to load registrations");
      }
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  const normalRegs = useMemo(
    () => registered.filter((r) => r.event?.eventType === "normal"),
    [registered]
  );

  const merchRegs = useMemo(
    () => registered.filter((r) => r.event?.eventType === "merchandise"),
    [registered]
  );

  const completedRegs = past;
  const cancelledRegs = cancelled;

  const tabData = {
    normal: normalRegs,
    merchandise: merchRegs,
    completed: completedRegs,
    cancelled: cancelledRegs,
  };

  const items = tabData[tab] || [];

  const downloadDataUrl = (dataUrl, filename) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPdf = async (ticketId, fallbackName) => {
    try {
      const res = await api.get(`/tickets/${ticketId}/pdf`, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `ticket-${fallbackName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // ignore
    }
  };

  return (
    <div className="events-container">
      <div className="page-header">
        <h2 className="title">Participation History</h2>
        <a className="calendar-export" href={calendarUrl} download>
          Export All to Calendar (.ics)
        </a>
      </div>
      {message && <p>{message}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setTab("normal")}>Normal</button>
        <button onClick={() => setTab("merchandise")}>Merchandise</button>
        <button onClick={() => setTab("completed")}>Completed</button>
        <button onClick={() => setTab("cancelled")}>Cancelled / Rejected</button>
      </div>

      <div className="events-grid">
        {items.map((reg) => (
          <div key={reg._id} className="event-card">
            <h3 className="event-title">{reg.event?.title || "Event"}</h3>

            <div className="event-category">Type: {reg.event?.eventType}</div>
            <div className="event-description">Organizer: {getOrganizerName(reg.event)}</div>
            <div className="event-description">Status: {reg.status || "registered"}</div>
            <div className="event-description">Team: -</div>
            <div className="event-description">
              Schedule: {formatDate(reg.event?.startDate)} - {formatDate(reg.event?.endDate)}
            </div>

            {reg.ticket?.qrDataUrl && (
              <div style={{ marginTop: 10 }}>
                <img
                  src={reg.ticket.qrDataUrl}
                  alt="Ticket QR"
                  className="ticket-qr"
                />
              </div>
            )}

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => navigate(`/events/${reg.event?._id}`)}>
                Ticket ID: {reg.ticket?.ticketId || `TKT-${reg._id}`}
              </button>
              {reg.ticket?.qrDataUrl && (
                <button
                  onClick={() =>
                    downloadDataUrl(
                      reg.ticket.qrDataUrl,
                      `ticket-${reg.ticket?.ticketId || reg._id}.png`
                    )
                  }
                >
                  Download QR (PNG)
                </button>
              )}
              {reg.ticket?._id && (
                <button onClick={() => downloadPdf(reg.ticket._id, reg.ticket?.ticketId || reg._id)}>
                  Download Ticket (PDF)
                </button>
              )}
            </div>
          </div>
        ))}

        {items.length === 0 && <p>No records in this tab.</p>}
      </div>
    </div>
  );
}
