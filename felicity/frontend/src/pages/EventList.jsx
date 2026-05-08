import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getUserRole } from "../utils/auth";
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

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [registeredEventIds, setRegisteredEventIds] = useState(new Set());
  const [followedOrganizerIds, setFollowedOrganizerIds] = useState(new Set());
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [followedOnly, setFollowedOnly] = useState(false);
  const role = getUserRole();
  const navigate = useNavigate();

  const normalizeText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const isSubsequence = (needle, haystack) => {
    if (!needle) return true;
    let i = 0;
    for (let j = 0; j < haystack.length && i < needle.length; j += 1) {
      if (needle[i] === haystack[j]) i += 1;
    }
    return i === needle.length;
  };

  const fuzzySearchMatch = (query, event) => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return true;

    const organizerName = getOrganizerName(event);
    const fields = [
      event?.title,
      event?.description,
      event?.category,
      event?.eventType,
      organizerName,
      ...(Array.isArray(event?.eventTags) ? event.eventTags : []),
    ];

    const queryCompact = normalizedQuery.replace(/\s+/g, "");

    return fields.some((field) => {
      const normalizedField = normalizeText(field);
      if (!normalizedField) return false;

      if (normalizedField.includes(normalizedQuery)) return true;

      const tokens = normalizedField.split(" ").filter(Boolean);
      const queryTokens = normalizedQuery.split(" ").filter(Boolean);
      const tokenMatch = queryTokens.every((qToken) =>
        tokens.some((token) => token.startsWith(qToken) || token.includes(qToken))
      );
      if (tokenMatch) return true;

      return isSubsequence(queryCompact, normalizedField.replace(/\s+/g, ""));
    });
  };

  const fuzzySearchScore = (query, event) => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return 0;

    const title = normalizeText(event?.title);
    const organizer = normalizeText(getOrganizerName(event));
    const tags = normalizeText((event?.eventTags || []).join(" "));
    const description = normalizeText(event?.description);
    const category = normalizeText(event?.category);

    const queryCompact = normalizedQuery.replace(/\s+/g, "");
    const scoreField = (field, weights) => {
      if (!field) return 0;
      if (field.startsWith(normalizedQuery)) return weights.prefix;

      const tokens = field.split(" ").filter(Boolean);
      if (tokens.some((token) => token.startsWith(normalizedQuery))) {
        return weights.tokenPrefix;
      }

      if (field.includes(normalizedQuery)) return weights.contains;
      if (isSubsequence(queryCompact, field.replace(/\s+/g, ""))) {
        return weights.subsequence;
      }
      return 0;
    };

    return Math.max(
      scoreField(title, { prefix: 1200, tokenPrefix: 1000, contains: 700, subsequence: 350 }),
      scoreField(organizer, { prefix: 1000, tokenPrefix: 820, contains: 600, subsequence: 280 }),
      scoreField(tags, { prefix: 850, tokenPrefix: 720, contains: 450, subsequence: 220 }),
      scoreField(description, { prefix: 700, tokenPrefix: 520, contains: 300, subsequence: 150 }),
      scoreField(category, { prefix: 650, tokenPrefix: 480, contains: 250, subsequence: 120 })
    );
  };

  const parseStartOfDay = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const parseEndOfDay = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T23:59:59.999`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const requests = [api.get("/events/browse")];

        if (role === "participant") {
          requests.push(api.get("/registrations/my"));
          requests.push(api.get("/users/me"));
        }

        const [browseRes, registrationsRes, meRes] = await Promise.all(requests);

        if (!active) return;
        setEvents(browseRes.data || []);

        if (role === "participant") {
          const registrations = Array.isArray(registrationsRes?.data)
            ? registrationsRes.data
            : [];
          const eventIds = new Set(
            registrations
              .filter((reg) => String(reg?.status || "registered") === "registered")
              .map((reg) => String(reg?.event?._id || reg?.event || ""))
              .filter(Boolean)
          );
          setRegisteredEventIds(eventIds);

          const followed = Array.isArray(meRes?.data?.followedOrganizers)
            ? meRes.data.followedOrganizers
            : [];
          setFollowedOrganizerIds(new Set(followed.map((id) => String(id))));
        } else {
          setRegisteredEventIds(new Set());
          setFollowedOrganizerIds(new Set());
        }

        setMessage("");
      } catch (err) {
        if (!active) return;
        setMessage(err.response?.data?.message || "Failed to load events");
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [role]);

  const filteredEvents = useMemo(() => {
    const start = parseStartOfDay(startDate);
    const end = parseEndOfDay(endDate);

    const filtered = (events || []).filter((event) => {
      if (eventType && String(event?.eventType || "") !== eventType) {
        return false;
      }

      if (eligibility) {
        const value = String(event?.eligibility || "");
        if (value !== "Both" && value !== eligibility) {
          return false;
        }
      }

      const eventStart = new Date(event?.startDate || 0);
      if (start && (!eventStart || Number.isNaN(eventStart.getTime()) || eventStart < start)) {
        return false;
      }

      if (end && (!eventStart || Number.isNaN(eventStart.getTime()) || eventStart > end)) {
        return false;
      }

      if (role === "participant" && followedOnly) {
        const organizerId = String(event?.organizer?._id || event?.organizer || "");
        if (!followedOrganizerIds.has(organizerId)) {
          return false;
        }
      }

      if (!fuzzySearchMatch(search, event)) {
        return false;
      }

      return true;
    });

    const normalizedQuery = normalizeText(search);
    if (!normalizedQuery) {
      return filtered.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    }

    return filtered
      .map((event) => ({
        event,
        score: fuzzySearchScore(search, event),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.event.startDate) - new Date(b.event.startDate);
      })
      .map((item) => item.event);
  }, [
    events,
    eventType,
    eligibility,
    startDate,
    endDate,
    role,
    followedOnly,
    followedOrganizerIds,
    search,
  ]);

  return (
    <div className="events-container">
      <h2 className="title">Browse Events</h2>
      {message && <p>{message}</p>}

      <div className="filters">
        <input
          className="filter-input"
          placeholder="Search events or organizers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="filter-row">
          <select className="filter-select" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">All Types</option>
            <option value="normal">Normal</option>
            <option value="merchandise">Merchandise</option>
          </select>

          <select className="filter-select" value={eligibility} onChange={(e) => setEligibility(e.target.value)}>
            <option value="">All Eligibility</option>
            <option value="IIIT">IIIT</option>
            <option value="Non-IIIT">Non-IIIT</option>
            <option value="Both">Both</option>
          </select>

          <label className="filter-date">
            <span>Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label className="filter-date">
            <span>End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>

        {role === "participant" && (
          <label className="filter-check">
            <input
              type="checkbox"
              checked={followedOnly}
              onChange={(e) => setFollowedOnly(e.target.checked)}
            />
            Followed Clubs Only
          </label>
        )}
      </div>

      <div className="events-grid">
        {filteredEvents.map((event) => {
          const eventId = String(event?._id || "");
          const isRegistered = role === "participant" && registeredEventIds.has(eventId);

          return (
          <div key={event._id} className="event-card">
            <h3 className="event-title">{event.title}</h3>

            <div className="event-category">Type: {event.eventType}</div>
            <div className="event-description">Organizer: {getOrganizerName(event)}</div>
            <div className="event-description">
              Schedule: {formatDate(event.startDate)} - {formatDate(event.endDate)}
            </div>
            <div className="event-description">Category: {event.category}</div>

            <div style={{ marginTop: "14px" }}>
              {role === "participant" && (
                <button onClick={() => navigate(`/events/${event._id}`)}>
                  {isRegistered ? "View" : "Register"}
                </button>
              )}

              {(role === "organizer" || role === "admin") && (
                <button onClick={() => navigate("/dashboard")}>Manage</button>
              )}
            </div>
          </div>
          );
        })}

        {filteredEvents.length === 0 && (
          <p className="event-description">No events found for selected filters.</p>
        )}
      </div>
    </div>
  );
}
