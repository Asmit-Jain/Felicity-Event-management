const formatIcsDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const iso = date.toISOString();
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
};

const escapeIcsText = (value) => {
  const text = String(value || "");
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
};

const buildEventLines = (event, options = {}) => {
  const dtStart = formatIcsDate(event?.startDate);
  const dtEnd = formatIcsDate(event?.endDate);
  const dtStamp = formatIcsDate(new Date());
  const uid = `${event?._id || "event"}@felicity`;
  const location = event?.location || options.defaultLocation || "";

  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    dtStamp ? `DTSTAMP:${dtStamp}` : null,
    dtStart ? `DTSTART:${dtStart}` : null,
    dtEnd ? `DTEND:${dtEnd}` : null,
    `SUMMARY:${escapeIcsText(event?.title || "Event")}`,
    event?.description ? `DESCRIPTION:${escapeIcsText(event.description)}` : null,
    location ? `LOCATION:${escapeIcsText(location)}` : null,
    "END:VEVENT",
  ].filter(Boolean);
};

export const buildCalendarIcs = (events = [], options = {}) => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Felicity//Event Management//EN",
  ];

  (events || []).forEach((event) => {
    lines.push(...buildEventLines(event, options));
  });

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
};

export const buildEventIcs = (event, options = {}) =>
  buildCalendarIcs([event], options);
