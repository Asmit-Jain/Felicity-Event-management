import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { BrowserMultiFormatReader } from "@zxing/browser";
import api from "../api/axios";
import { getUserRole } from "../utils/auth";
import "./EventDetails.css";

export default function EventDetails() {
  const { id } = useParams();
  const role = getUserRole();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [message, setMessage] = useState("");
  const [registered, setRegistered] = useState(false);
  const [ticketInfo, setTicketInfo] = useState(null);
  const [formResponses, setFormResponses] = useState({});
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const [analytics, setAnalytics] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState("");
  const [attendanceReason, setAttendanceReason] = useState("");
  const [organizerMessage, setOrganizerMessage] = useState("");
  const [attendanceBusyId, setAttendanceBusyId] = useState("");
  const [qrScanBusy, setQrScanBusy] = useState(false);
  const [qrScanNotice, setQrScanNotice] = useState({ type: "", text: "" });

  const [editForm, setEditForm] = useState(null);
  const [editRegistrationFormFields, setEditRegistrationFormFields] = useState([]);
  const [editMerchandiseItems, setEditMerchandiseItems] = useState([]);
  const [isFormLocked, setIsFormLocked] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [publishedEdit, setPublishedEdit] = useState({
    description: "",
    venue: "",
    totalPrizeMoney: "",
    registrationDeadline: "",
    registrationLimit: 1,
  });
  const [actionBusy, setActionBusy] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [discussionMessages, setDiscussionMessages] = useState([]);
  const [discussionMessage, setDiscussionMessage] = useState("");
  const [discussionError, setDiscussionError] = useState("");
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [announcementMode, setAnnouncementMode] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const discussionListRef = useRef(null);
  const socketRef = useRef(null);
  const atBottomRef = useRef(true);
  const qrReaderRef = useRef(null);
  const lastReadSentAtRef = useRef("");

  const isOrganizerView = role === "organizer" || role === "admin";
  const isParticipantView = role === "participant";

  const socketServerUrl = useMemo(() => {
    const direct = String(import.meta.env.VITE_SOCKET_URL || "").trim();
    if (direct) return direct;

    const apiBase = String(api.defaults.baseURL || "").trim();
    if (apiBase) return apiBase.replace(/\/api\/?$/, "");

    return "http://localhost:5000";
  }, []);

  const currentUserId = useMemo(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      return parsed?.id || parsed?._id || "";
    } catch {
      return "";
    }
  }, []);

  const latestMessageTimestamp = useCallback((messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return "";

    let latest = null;
    messages.forEach((item) => {
      if (!item?.createdAt) return;
      const date = new Date(item.createdAt);
      if (Number.isNaN(date.getTime())) return;
      if (!latest || date > latest) latest = date;
    });

    return latest ? latest.toISOString() : "";
  }, []);

  const markDiscussionRead = useCallback(
    async (messages) => {
      const canViewDiscussion = isOrganizerView || registered;
      if (!event || !canViewDiscussion) return;

      const lastSeenAt = latestMessageTimestamp(messages);
      if (!lastSeenAt || lastReadSentAtRef.current === lastSeenAt) return;

      try {
        await api.post(`/events/${id}/messages/read`, { lastSeenAt });
        lastReadSentAtRef.current = lastSeenAt;
        window.dispatchEvent(new Event("discussion-read-updated"));
      } catch {
        // Ignore read-state failures so the main discussion flow keeps working.
      }
    },
    [event, id, isOrganizerView, registered, latestMessageTimestamp]
  );

  const upsertDiscussionMessage = useCallback((msg) => {
    if (!msg?._id) return;

    setDiscussionMessages((prev) => {
      const idx = prev.findIndex((item) => item._id === msg._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = msg;
        return next;
      }
      return [...prev, msg];
    });
  }, []);

  const toDateTimeLocalValue = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const toUtcIsoFromLocalInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  };

  const normalizeMerchandiseItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      return [
        {
          name: "",
          itemPrice: "",
          variants: [{ size: "", color: "", stock: 0 }],
        },
      ];
    }

    return items.map((item) => ({
      ...item,
      itemPrice:
        item?.itemPrice === undefined || item?.itemPrice === null
          ? ""
          : String(item.itemPrice),
      variants: Array.isArray(item?.variants)
        ? item.variants
        : [{ size: "", color: "", stock: 0 }],
    }));
  };

  useEffect(() => {
    let active = true;

    api
      .get(`/events/${id}`)
      .then((res) => {
        if (!active) return;
        const data = res.data;
        setEvent(data);
        setFormResponses({});
        setSelectedItemIndex(0);
        setSelectedVariantIndex(0);
        setQuantity(1);
        setMessage("");

        if (isOrganizerView) {
          setEditForm({
            title: data.title || "",
            description: data.description || "",
            venue: data.venue || "",
            totalPrizeMoney:
              data.totalPrizeMoney === undefined || data.totalPrizeMoney === null
                ? ""
                : String(data.totalPrizeMoney),
            category: data.category || "Technical",
            eventType: data.eventType || "normal",
            eligibility: data.eligibility || "Both",
            registrationDeadline: toDateTimeLocalValue(data.registrationDeadline),
            registrationLimit: Number(data.registrationLimit || 1),
            startDate: toDateTimeLocalValue(data.startDate),
            endDate: toDateTimeLocalValue(data.endDate),
            registrationFee:
              data.registrationFee === undefined || data.registrationFee === null
                ? ""
                : String(data.registrationFee),
          });

          setEditRegistrationFormFields(data.registrationFormFields || []);
          setIsFormLocked(!!data.isFormLocked);
          setEditMerchandiseItems(normalizeMerchandiseItems(data.merchandiseItems));

          setPublishedEdit({
            description: data.description || "",
            venue: data.venue || "",
            totalPrizeMoney:
              data.totalPrizeMoney === undefined || data.totalPrizeMoney === null
                ? ""
                : String(data.totalPrizeMoney),
            registrationDeadline: toDateTimeLocalValue(data.registrationDeadline),
            registrationLimit: Number(data.registrationLimit || 1),
          });
        }
      })
      .catch(() => setMessage("Failed to load event"));

    return () => {
      active = false;
    };
  }, [id, isOrganizerView]);

  useEffect(() => {
    if (!isParticipantView) return;
    let active = true;

    setRegistered(false);
    setTicketInfo(null);

    api
      .get("/registrations/my")
      .then((res) => {
        if (!active) return;
        const registrations = Array.isArray(res.data) ? res.data : [];
        const match = registrations.find((reg) => String(reg?.event?._id) === String(id));
        if (!match) return;
        setRegistered(true);
        if (match.ticket) {
          setTicketInfo({
            ticketId: match.ticket.ticketId,
            qrDataUrl: match.ticket.qrDataUrl,
            ticketDbId: match.ticket._id,
          });
        }
      })
      .catch(() => {
        if (!active) return;
      });

    return () => {
      active = false;
    };
  }, [id, isParticipantView]);

  useEffect(() => {
    if (!isOrganizerView || !event || event.status === "draft") return;
    let active = true;

    const run = async () => {
      try {
        const [analyticsRes, participantsRes] = await Promise.all([
          api.get(`/events/${id}/analytics`),
          api.get(`/registrations/event/${id}`),
        ]);
        if (!active) return;
        setAnalytics(analyticsRes.data || {});
        setParticipants(participantsRes.data?.registrations || []);
        setOrganizerMessage("");
      } catch (err) {
        if (!active) return;
        setOrganizerMessage(err.response?.data?.message || "Failed to load organizer data");
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [id, isOrganizerView, event]);

  useEffect(() => {
    const canViewDiscussion = isOrganizerView || registered;
    if (!event || !canViewDiscussion) return;
    let active = true;

    const run = async () => {
      try {
        setDiscussionLoading(true);
        const res = await api.get(`/events/${id}/messages`);
        if (!active) return;
        setDiscussionMessages(res.data || []);
        setDiscussionError("");
        setUnreadCount(0);
        lastReadSentAtRef.current = "";
        atBottomRef.current = true;
        markDiscussionRead(res.data || []);
        setTimeout(() => {
          if (discussionListRef.current) {
            discussionListRef.current.scrollTop =
              discussionListRef.current.scrollHeight;
          }
        }, 0);
      } catch (err) {
        if (!active) return;
        setDiscussionError(err.response?.data?.message || "Failed to load messages");
      } finally {
        if (active) setDiscussionLoading(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [id, event, isOrganizerView, registered, markDiscussionRead]);

  useEffect(() => {
    const canViewDiscussion = isOrganizerView || registered;
    if (!event || !canViewDiscussion) return;

    const token = localStorage.getItem("token");
    const socket = io(socketServerUrl, {
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("event:join", { eventId: id });
    });

    socket.on("event:message:new", (msg) => {
      upsertDiscussionMessage(msg);

      const authorId = String(msg?.author?._id || msg?.author || "");
      const isOwnMessage = authorId && authorId === String(currentUserId);
      if (!isOwnMessage) {
        window.dispatchEvent(new Event("discussion-new-message"));
        if (document.hidden && typeof window !== "undefined" && "Notification" in window) {
          const title = event?.title || "Event";
          const preview = String(msg?.content || "New discussion message").slice(0, 120);
          if (Notification.permission === "granted") {
            new Notification(`New message in ${title}`, { body: preview });
          } else if (Notification.permission === "default") {
            Notification.requestPermission().catch(() => {});
          }
        }
      }

      if (!atBottomRef.current) {
        setUnreadCount((prev) => prev + 1);
      } else {
        setTimeout(() => {
          if (discussionListRef.current) {
            discussionListRef.current.scrollTop =
              discussionListRef.current.scrollHeight;
          }
        }, 0);
      }
    });

    socket.on("event:message:update", (msg) => {
      if (!msg?.deleted) {
        upsertDiscussionMessage(msg);
      }
    });

    socket.on("event:message:reaction", (msg) => {
      upsertDiscussionMessage(msg);
    });

    socket.on("event:message:delete", (msg) => {
      if (!msg?._id || !msg?.deleted) return;
      upsertDiscussionMessage(msg);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    id,
    event,
    isOrganizerView,
    registered,
    socketServerUrl,
    currentUserId,
    upsertDiscussionMessage,
  ]);

  useEffect(() => {
    if (!discussionMessages.length) return;
    if (!atBottomRef.current) return;
    markDiscussionRead(discussionMessages);
  }, [discussionMessages, markDiscussionRead]);

  const handleRegister = async () => {
    try {
      const payload = {};

      if (event?.eventType === "normal") {
        payload.formResponses = formResponses;
      }

      if (event?.eventType === "merchandise") {
        payload.merchandiseSelection = {
          itemIndex: selectedItemIndex,
          variantIndex: selectedVariantIndex,
          quantity,
        };
      }

      const res = await api.post(`/registrations/${id}`, payload);
      setRegistered(true);
        if (res.data?.ticketId || res.data?.qrDataUrl) {
        setTicketInfo({
          ticketId: res.data.ticketId,
          qrDataUrl: res.data.qrDataUrl,
          ticketDbId: res.data.ticketDbId,
        });
      }
      if (res.data?.emailStatus === "sent") {
        setMessage("🎉 Successfully registered! Ticket email sent.");
      } else if (res.data?.emailStatus === "failed") {
        setMessage(
          `🎉 Registered, but ticket email failed to send${res.data?.emailError ? `: ${res.data.emailError}` : ""}`
        );
      } else if (res.data?.emailStatus === "skipped") {
        setMessage("🎉 Registered, but ticket email was skipped (SMTP not configured on server).");
      } else {
        setMessage("🎉 Successfully registered!");
      }
    } catch (err) {
      setMessage(err.response?.data?.message || "Registration failed");
    }
  };

  const handleCancelRegistration = async () => {
    if (cancelBusy) return;
    const confirmed = window.confirm("Cancel your registration for this event?");
    if (!confirmed) return;

    setCancelBusy(true);
    setMessage("");
    try {
      await api.delete(`/registrations/${id}`);
      setRegistered(false);
      setTicketInfo(null);
      setMessage("Registration cancelled successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to cancel registration");
    } finally {
      setCancelBusy(false);
    }
  };

  const downloadDataUrl = (dataUrl, filename) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPdf = async (ticketId) => {
    try {
      const res = await api.get(`/tickets/${ticketId}/pdf`, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `ticket-${ticketId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // ignore
    }
  };

  const downloadIcs = async () => {
    if (!event) return;
    try {
      const res = await api.get(`/events/${id}/calendar.ics`, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(res.data);
      const slug = String(event?.title || "event")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${slug || "event"}-event.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // ignore
    }
  };

  const toUtcCompact = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  };

  const buildGoogleCalendarUrl = (data) => {
    if (!data) return "";
    const start = toUtcCompact(data.startDate);
    const end = toUtcCompact(data.endDate);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: data.title || "Event",
      dates: `${start}/${end}`,
      details: data.description || "",
      location: "IIIT Hyderabad",
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;
  };

  const buildOutlookCalendarUrl = (data) => {
    if (!data) return "";
    const start = new Date(data.startDate).toISOString().replace(/\.\d{3}Z$/, "Z");
    const end = new Date(data.endDate).toISOString().replace(/\.\d{3}Z$/, "Z");
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: data.title || "Event",
      startdt: start,
      enddt: end,
      body: data.description || "",
      location: "IIIT Hyderabad",
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  };

  const openCalendarLink = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noreferrer");
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const onFileFieldChange = async (key, file) => {
    if (!file) {
      setFormResponses((p) => ({ ...p, [key]: null }));
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFormResponses((p) => ({
        ...p,
        [key]: {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: Number(file.size || 0),
          dataUrl: String(dataUrl || ""),
        },
      }));
    } catch {
      setMessage("Failed to read file for upload field");
    }
  };

  const getStatusLabel = (data) => {
    if (!data) return "Draft";
    if (data.status === "draft") return "Draft";
    if (data.status === "closed") return "Closed";
    if (data.status === "completed") return "Completed";
    const now = new Date();
    const start = new Date(data.startDate);
    if (now < start) return "Published";
    return "Ongoing";
  };

  const getLifecycleStatus = (data) => {
    if (!data) return "draft";
    if (data.status === "draft") return "draft";
    if (data.status === "closed") return "closed";
    if (data.status === "completed") return "completed";
    const now = new Date();
    const start = new Date(data.startDate);
    return now < start ? "published" : "ongoing";
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  const submitMessage = async () => {
    if (!messageText.trim()) return;
    setDiscussionMessage("");
    setDiscussionError("");

    try {
      const payload = {
        content: messageText.trim(),
      };
      if (isOrganizerView && announcementMode && !replyTo) {
        payload.type = "announcement";
      }
      if (replyTo?._id) {
        payload.parentMessage = replyTo._id;
      }
      const res = await api.post(`/events/${id}/messages`, payload);
      upsertDiscussionMessage(res.data);
      setMessageText("");
      setAnnouncementMode(false);
      setReplyTo(null);
      setDiscussionMessage("Message sent");
      atBottomRef.current = true;
      setUnreadCount(0);
      setTimeout(() => {
        if (discussionListRef.current) {
          discussionListRef.current.scrollTop =
            discussionListRef.current.scrollHeight;
        }
      }, 0);
    } catch (err) {
      setDiscussionError(err.response?.data?.message || "Failed to send message");
    }
  };

  const handleDiscussionScroll = () => {
    if (!discussionListRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = discussionListRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;
    atBottomRef.current = atBottom;
    if (atBottom) {
      setUnreadCount(0);
      markDiscussionRead(discussionMessages);
    }
  };

  const scrollToBottom = () => {
    if (!discussionListRef.current) return;
    discussionListRef.current.scrollTop = discussionListRef.current.scrollHeight;
    atBottomRef.current = true;
    setUnreadCount(0);
    markDiscussionRead(discussionMessages);
  };

  const togglePin = async (msg) => {
    if (msg?.deleted) return;
    try {
      const action = msg.pinned ? "unpin" : "pin";
      const res = await api.put(`/events/${id}/messages/${msg._id}/${action}`);
      setDiscussionMessages((prev) =>
        prev.map((item) => (item._id === msg._id ? res.data : item))
      );
    } catch (err) {
      setDiscussionError(err.response?.data?.message || "Failed to update pin");
    }
  };

  const deleteMessage = async (msg) => {
    if (msg?.deleted) return;
    if (!window.confirm("Delete this message?") ) return;
    try {
      const res = await api.delete(`/events/${id}/messages/${msg._id}`);
      setDiscussionMessages((prev) =>
        prev.map((item) => (item._id === msg._id ? res.data : item))
      );
    } catch (err) {
      setDiscussionError(err.response?.data?.message || "Failed to delete message");
    }
  };

  const reactToMessage = async (msg, emoji) => {
    const normalizedEmoji = String(emoji || "").trim();
    if (!normalizedEmoji) return;
    if (msg?.deleted) {
      setDiscussionError("Cannot react to a deleted message");
      return;
    }

    try {
      const res = await api.post(`/events/${id}/messages/${msg._id}/react`, {
        emoji: normalizedEmoji,
      });
      setDiscussionMessages((prev) =>
        prev.map((item) => (item._id === msg._id ? res.data : item))
      );
    } catch (err) {
      setDiscussionError(err.response?.data?.message || "Failed to react");
    }
  };

  const reactWithCustomEmoji = (msg) => {
    const emoji = window.prompt("Enter any emoji to react");
    if (!emoji) return;
    reactToMessage(msg, emoji);
  };

  const reactionEmojis = ["👍", "❤️", "😮"];

  const parentKeyOf = (parentMessage) => {
    if (!parentMessage) return "ROOT";
    if (typeof parentMessage === "string") return parentMessage;
    if (typeof parentMessage === "object") {
      return String(parentMessage._id || parentMessage.id || "ROOT");
    }
    return String(parentMessage);
  };

  const threadByParent = useMemo(() => {
    const map = new Map();

    discussionMessages.forEach((msg) => {
      const key = parentKeyOf(msg.parentMessage);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(msg);
    });

    map.forEach((items, key) => {
      if (key === "ROOT") {
        items.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(a.createdAt) - new Date(b.createdAt);
        });
      } else {
        items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      }
      map.set(key, items);
    });

    return map;
  }, [discussionMessages]);

  const rootDiscussionMessages = threadByParent.get("ROOT") || [];

  const getDisplayName = (msg) => {
    const author = msg?.author || {};
    if (msg?.authorRole === "organizer") {
      return (
        author.organizerName ||
        `${author.firstName || ""} ${author.lastName || ""}`.trim() ||
        "Organizer"
      );
    }
    return `${author.firstName || ""} ${author.lastName || ""}`.trim() || "Participant";
  };

  const renderDiscussionNode = (msg, depth = 0) => {
    const reactions = Array.isArray(msg?.reactions) ? msg.reactions : [];
    const availableEmojis = Array.from(
      new Set([
        ...reactionEmojis,
        ...reactions.map((entry) => String(entry?.emoji || "").trim()).filter(Boolean),
      ])
    );
    const isDeleted = Boolean(msg?.deleted);
    const children = threadByParent.get(String(msg?._id)) || [];

    return (
      <div
        key={msg._id}
        className={`discussion-item ${msg.type === "announcement" ? "announcement" : ""} ${
          isDeleted ? "deleted" : ""
        } ${depth > 0 ? "discussion-reply" : ""}`}
      >
        <div className="discussion-meta">
          <span className="discussion-author">{getDisplayName(msg)}</span>
          {msg.pinned && depth === 0 && <span className="discussion-pin">Pinned</span>}
          {msg.type === "announcement" && depth === 0 && (
            <span className="discussion-tag">Announcement</span>
          )}
          {isDeleted && <span className="discussion-tag">Deleted</span>}
          <span className="discussion-time">
            {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}
          </span>
        </div>
        <p className="discussion-text">{msg.content}</p>
        <div className="discussion-footer">
          <div className="discussion-reactions">
            {availableEmojis.map((emoji) => {
              const entry = reactions.find((item) => item.emoji === emoji);
              const reacted = entry?.users?.some(
                (userId) => String(userId) === String(currentUserId)
              );
              const count = entry?.users?.length || 0;
              return (
                <button
                  key={emoji}
                  type="button"
                  className={`reaction-button ${reacted ? "active" : ""}`}
                  onClick={() => reactToMessage(msg, emoji)}
                  disabled={isDeleted}
                >
                  <span>{emoji}</span>
                  {count > 0 && <span className="reaction-count">{count}</span>}
                </button>
              );
            })}
            {!isDeleted && (
              <button
                type="button"
                className="reaction-button"
                onClick={() => reactWithCustomEmoji(msg)}
              >
                +
              </button>
            )}
          </div>
          <div className="discussion-actions">
            {!isDeleted && (
              <button type="button" onClick={() => setReplyTo(msg)}>
                Reply
              </button>
            )}
            {isOrganizerView && !isDeleted && depth === 0 && (
              <button type="button" onClick={() => togglePin(msg)}>
                {msg.pinned ? "Unpin" : "Pin"}
              </button>
            )}
            {isOrganizerView && !isDeleted && (
              <button type="button" onClick={() => deleteMessage(msg)}>
                Delete
              </button>
            )}
          </div>
        </div>

        {children.length > 0 && (
          <div className="discussion-replies">
            {children.map((child) => renderDiscussionNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderDiscussionSection = () => {
    if (!(isOrganizerView || registered)) return null;

    return (
      <section className="event-section discussion-section">
        <div className="section-header">
          <h3>Discussion</h3>
          <p>Ask questions, share updates, and interact with the event community.</p>
        </div>

        {unreadCount > 0 && (
          <button type="button" className="discussion-unread" onClick={scrollToBottom}>
            {unreadCount} new message{unreadCount > 1 ? "s" : ""}
          </button>
        )}

        {discussionLoading && <p className="discussion-message">Loading messages...</p>}
        {discussionError && <p className="discussion-error">{discussionError}</p>}
        {discussionMessage && <p className="discussion-message">{discussionMessage}</p>}

        <div className="discussion-list" ref={discussionListRef} onScroll={handleDiscussionScroll}>
          {rootDiscussionMessages.map((msg) => renderDiscussionNode(msg, 0))}

          {discussionMessages.length === 0 && !discussionLoading && (
            <p className="discussion-empty">No messages yet. Start the conversation.</p>
          )}
        </div>

        <div className="discussion-composer">
          <div className="composer-header">
            <span>Post a message</span>
            {isOrganizerView && (
              <label className="announcement-toggle">
                <input
                  type="checkbox"
                  checked={announcementMode}
                  onChange={(e) => setAnnouncementMode(e.target.checked)}
                  disabled={Boolean(replyTo)}
                />
                Mark as announcement
              </label>
            )}
          </div>
          {replyTo && (
            <div className="reply-banner">
              <span>
                Replying to {replyTo.author?.organizerName || replyTo.author?.firstName || "message"}
              </span>
              <button type="button" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            </div>
          )}
          <textarea
            rows={3}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Write your message..."
          />
          <button type="button" onClick={submitMessage}>
            Send Message
          </button>
        </div>
      </section>
    );
  };

  const deadlinePassed = event?.registrationDeadline
    ? new Date() > new Date(event.registrationDeadline)
    : false;
  const registrationCount = Number(event?.registrationCount || 0);
  const registrationLimit = Number(event?.registrationLimit || 0);
  const limitReached = registrationLimit > 0 && registrationCount >= registrationLimit;

  const selectedVariant =
    event?.eventType === "merchandise"
      ? event?.merchandiseItems?.[selectedItemIndex]?.variants?.[selectedVariantIndex]
      : null;
  const selectedMerchandiseItem =
    event?.eventType === "merchandise"
      ? event?.merchandiseItems?.[selectedItemIndex]
      : null;
  const selectedItemPrice = Number(selectedMerchandiseItem?.itemPrice || 0);
  const selectedTotalPrice = Math.max(0, selectedItemPrice) * Math.max(0, Number(quantity || 0));
  const stock = Number(selectedVariant?.stock ?? 0);
  const outOfStock = event?.eventType === "merchandise" && stock <= 0;
  const insufficientStock = event?.eventType === "merchandise" && quantity > stock;

  const blockReason = (() => {
    if (deadlinePassed) return "Registration deadline has passed";
    if (limitReached) return "Registration limit reached";
    if (outOfStock) return "Selected variant is out of stock";
    if (insufficientStock) return "Selected quantity exceeds stock";
    return "";
  })();

  const disableRegister = !!blockReason || registered;

  const statusLabel = getStatusLabel(event);
  const statusClass = statusLabel.toLowerCase();
  const lifecycleStatus = getLifecycleStatus(event);

  const analyticsSummary = useMemo(() => {
    const registrations = Number(analytics?.activeRegistrations || 0);
    const registrationLimit = Number(event?.registrationLimit || 0);
    const present = Number(analytics?.attendedRegistrations || 0);
    const absent = Math.max(0, registrations - present);
    const totalRevenue = Number(analytics?.totalRevenue || 0);

    return {
      registrations,
      registrationLimit,
      present,
      absent,
      totalRevenue,
    };
  }, [analytics, event?.registrationLimit]);

  const attendanceSnapshot = useMemo(() => {
    const total = Number(participants?.length || 0);
    const present = (participants || []).reduce(
      (count, reg) => count + (reg?.attended ? 1 : 0),
      0
    );
    return {
      present,
      pending: Math.max(0, total - present),
      total,
    };
  }, [participants]);

  const patchAttendanceState = (registrationId, attended, attendedAt) => {
    const before = participants.find((reg) => String(reg.id) === String(registrationId));
    const wasAttended = Boolean(before?.attended);

    setParticipants((prev) =>
      prev.map((reg) =>
        String(reg.id) === String(registrationId)
          ? {
              ...reg,
              attended: Boolean(attended),
              attendedAt: attendedAt || null,
            }
          : reg
      )
    );

    if (wasAttended === Boolean(attended)) return;

    const delta = attended ? 1 : -1;
    setAnalytics((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        attendedRegistrations: Math.max(
          0,
          Number(prev.attendedRegistrations || 0) + delta
        ),
      };
    });
  };

  const decodeQrTextFromImage = async (file) => {
    if (!qrReaderRef.current) {
      qrReaderRef.current = new BrowserMultiFormatReader();
    }

    const imageUrl = window.URL.createObjectURL(file);
    try {
      const result = await qrReaderRef.current.decodeFromImageUrl(imageUrl);
      const text =
        typeof result?.getText === "function" ? result.getText() : result?.text;
      if (!text || !String(text).trim()) {
        throw new Error("No QR code data found in uploaded image");
      }
      return String(text).trim();
    } finally {
      window.URL.revokeObjectURL(imageUrl);
    }
  };

  const handleQrUploadScan = async (e) => {
    const input = e.target;
    const file = input?.files?.[0];
    if (!file) return;

    setOrganizerMessage("");
    setQrScanNotice({ type: "", text: "" });
    setQrScanBusy(true);

    try {
      const qrDataText = await decodeQrTextFromImage(file);

      let parsed;
      try {
        parsed = JSON.parse(qrDataText);
      } catch {
        throw new Error("Uploaded QR is invalid. Please upload a valid ticket QR image.");
      }

      const ticketId = String(parsed?.ticketId || "").trim();
      const eventId = String(parsed?.eventId || "").trim();

      if (!ticketId) {
        throw new Error("Invalid ticket QR: missing ticketId");
      }

      if (!eventId) {
        throw new Error("Invalid ticket QR: missing eventId");
      }

      if (eventId !== String(id)) {
        throw new Error("Wrong event QR. Please upload a ticket QR for this event.");
      }

      const res = await api.post(`/registrations/event/${id}/attendance/scan`, {
        qrData: qrDataText,
      });

      const updated = res.data?.registration;
      if (!updated?.id) {
        throw new Error("Attendance updated but registration details were not returned");
      }

      patchAttendanceState(updated.id, updated.attended, updated.attendedAt);

      const fullName = [updated?.participant?.firstName, updated?.participant?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const displayName = fullName || updated?.participant?.email || "participant";
      const scannedAt = updated?.attendedAt
        ? new Date(updated.attendedAt).toLocaleString()
        : "now";

      setQrScanNotice({
        type: "success",
        text: `Attendance marked for ${displayName} at ${scannedAt}`,
      });
    } catch (err) {
      if (err?.response?.status === 409) {
        const attendedAt = err.response?.data?.registration?.attendedAt;
        const scannedAt = attendedAt ? new Date(attendedAt).toLocaleString() : "an earlier time";
        setQrScanNotice({
          type: "info",
          text: `Ticket already scanned at ${scannedAt}`,
        });
      } else {
        const errorMessage =
          err?.response?.data?.message || err?.message || "Failed to scan uploaded QR image";
        setQrScanNotice({ type: "error", text: errorMessage });
      }
    } finally {
      setQrScanBusy(false);
      if (input) input.value = "";
    }
  };

  const updateParticipantAttendance = async (registrationId, attended, reason = "") => {
    setOrganizerMessage("");
    setAttendanceBusyId(String(registrationId));
    try {
      const normalizedReason = String(reason || "").trim();
      const res = await api.put(
        `/registrations/event/${id}/${registrationId}/attendance`,
        {
          attended,
          reason: normalizedReason || null,
        }
      );
      const updated = res.data?.registration;
      if (!updated) return;

      patchAttendanceState(updated.id || registrationId, updated.attended, updated.attendedAt);
    } catch (err) {
      setOrganizerMessage(err.response?.data?.message || "Failed to update attendance");
    } finally {
      setAttendanceBusyId("");
    }
  };

  const participantRows = useMemo(() => {
    const fee = Number(event?.registrationFee || 0);
    const paymentLabel = fee > 0 ? "Paid" : "Free";

    return (participants || []).map((reg) => {
      const participant = reg.participant || {};
      const name = [participant.firstName, participant.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      return {
        id: reg.id,
        name: name || "-",
        email: participant.email || "-",
        regDate: reg.registeredAt ? new Date(reg.registeredAt).toLocaleDateString() : "-",
        payment: paymentLabel,
        team:
          reg.teamName && String(reg.teamName).trim()
            ? Number(reg.teamSize || 1) > 1
              ? `${reg.teamName} (${Number(reg.teamSize)})`
              : String(reg.teamName)
            : event?.participationType === "individual"
              ? "Individual"
              : "-",
        attended: Boolean(reg.attended),
        attendance: reg.attended ? "Present" : "Not Marked",
        attendedAt: reg.attendedAt ? new Date(reg.attendedAt).toLocaleString() : "-",
      };
    });
  }, [participants, event?.registrationFee]);

  const filteredParticipants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return participantRows;
    return participantRows.filter((row) =>
      `${row.name} ${row.email} ${row.team}`.toLowerCase().includes(query)
    );
  }, [participantRows, search]);

  const exportCsv = () => {
    const headers = [
      "Name",
      "Email",
      "Reg Date",
      "Payment",
      "Team",
      "Attendance",
      "Attended At",
    ];

    const rows = filteredParticipants.map((row) => [
      row.name,
      row.email,
      row.regDate,
      row.payment,
      row.team,
      row.attendance,
      row.attendedAt,
    ]);

    const escape = (value) => {
      const str = String(value ?? "");
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csv = [headers, ...rows]
      .map((line) => line.map(escape).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `event-${id}-participants.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const onEditChange = (key) => (e) => {
    const shouldKeepAsText = key === "registrationFee" || key === "totalPrizeMoney";
    const value =
      e.target.type === "number" && !shouldKeepAsText
        ? Number(e.target.value)
        : e.target.value;
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const moveEditRegistrationField = (index, direction) => {
    if (isFormLocked) return;
    setEditRegistrationFormFields((prev) => {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const buildDraftPayload = () => {
    if (!editForm) return null;

    const payload = {
      title: editForm.title,
      description: editForm.description,
      venue: editForm.eventType === "normal" ? String(editForm.venue || "").trim() || null : null,
      totalPrizeMoney: editForm.eventType === "normal" ? Number(editForm.totalPrizeMoney || 0) : 0,
      category: editForm.category,
      eventType: editForm.eventType,
      participationType: "individual",
      eligibility: editForm.eligibility,
      merchandiseItems:
        editForm.eventType === "merchandise" ? editMerchandiseItems : [],
      registrationDeadline: toUtcIsoFromLocalInput(editForm.registrationDeadline),
      registrationLimit: editForm.registrationLimit,
      startDate: toUtcIsoFromLocalInput(editForm.startDate),
      endDate: toUtcIsoFromLocalInput(editForm.endDate),
      registrationFee:
        editForm.eventType === "normal"
          ? Number(editForm.registrationFee || 0)
          : 0,
    };

    if (editForm.eventType === "normal" && !isFormLocked) {
      payload.registrationFormFields = editRegistrationFormFields;
    }

    return payload;
  };

  const saveDraft = async (e) => {
    e.preventDefault();
    if (!editForm) return;

    setSavingDraft(true);
    setDraftMessage("");

    try {
      const payload = buildDraftPayload();
      if (!payload) {
        setDraftMessage("Nothing to save");
        return;
      }

      await api.put(`/events/${id}`, payload);
      setDraftMessage("Draft updated successfully");
      navigate(0);
    } catch (err) {
      setDraftMessage(err.response?.data?.message || "Failed to update draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const publishDraft = async () => {
    setActionBusy("publish");
    setActionMessage("");
    try {
      const payload = buildDraftPayload();
      if (payload) {
        await api.put(`/events/${id}`, payload);
      }

      await api.put(`/events/${id}/publish`);
      setActionMessage("Draft published successfully");
      navigate(0);
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Failed to publish draft");
    } finally {
      setActionBusy("");
    }
  };

  const savePublishedUpdates = async (e) => {
    e.preventDefault();
    setActionBusy("published-update");
    setActionMessage("");
    try {
      const payload = {};

      const nextDescription = String(publishedEdit.description || "").trim();
      const currentDescription = String(event?.description || "").trim();
      if (nextDescription && nextDescription !== currentDescription) {
        payload.description = nextDescription;
      }

      if (event?.eventType === "normal") {
        const nextVenue = String(publishedEdit.venue || "").trim() || null;
        const currentVenue = String(event?.venue || "").trim() || null;
        if (nextVenue !== currentVenue) {
          payload.venue = nextVenue;
        }

        const nextPrizeMoney = Number(publishedEdit.totalPrizeMoney || 0);
        const currentPrizeMoney = Number(event?.totalPrizeMoney || 0);
        if (Number.isFinite(nextPrizeMoney) && nextPrizeMoney !== currentPrizeMoney) {
          payload.totalPrizeMoney = nextPrizeMoney;
        }
      }

      const nextDeadlineIso = toUtcIsoFromLocalInput(publishedEdit.registrationDeadline);
      const nextDeadlineMs = nextDeadlineIso ? new Date(nextDeadlineIso).getTime() : NaN;
      const currentDeadlineMs = event?.registrationDeadline
        ? new Date(event.registrationDeadline).getTime()
        : NaN;
      if (!Number.isNaN(nextDeadlineMs) && nextDeadlineMs !== currentDeadlineMs) {
        payload.registrationDeadline = nextDeadlineIso;
      }

      const nextLimit = Number(publishedEdit.registrationLimit);
      const currentLimit = Number(event?.registrationLimit || 0);
      if (Number.isFinite(nextLimit) && nextLimit !== currentLimit) {
        payload.registrationLimit = nextLimit;
      }

      if (Object.keys(payload).length === 0) {
        setActionMessage("No changes to save");
        return;
      }

      await api.put(`/events/${id}`, payload);
      setActionMessage("Published event updated successfully");
      navigate(0);
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Failed to update published event");
    } finally {
      setActionBusy("");
    }
  };

  const closeEventRegistrations = async () => {
    setActionBusy("close-registrations");
    setActionMessage("");
    try {
      await api.put(`/events/${id}/close-registrations`);
      setActionMessage("Registrations closed successfully");
      navigate(0);
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Failed to close registrations");
    } finally {
      setActionBusy("");
    }
  };

  const closeEventStatus = async () => {
    setActionBusy("close-event");
    setActionMessage("");
    try {
      await api.put(`/events/${id}/close`);
      setActionMessage("Event closed successfully");
      navigate(0);
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Failed to close event");
    } finally {
      setActionBusy("");
    }
  };

  const completeEventStatus = async () => {
    setActionBusy("complete-event");
    setActionMessage("");
    try {
      await api.put(`/events/${id}/complete`);
      setActionMessage("Event marked completed");
      navigate(0);
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Failed to mark event completed");
    } finally {
      setActionBusy("");
    }
  };

  if (!event) {
    return (
      <p style={{ padding: "40px" }}>
        {message || "Loading..."}
      </p>
    );
  }

  return (
    <div className="event-details">
      <div className="event-header">
        <h2 className="event-title">{event.title}</h2>
        <span className={`status-tag status-${statusClass}`}>{statusLabel}</span>
      </div>

      {isOrganizerView ? (
        <div className="organizer-details">
          <section className="event-section">
            <div className="section-header">
              <h3>Overview</h3>
              <p>Key event information for organizers.</p>
            </div>

            <div className="details-table">
              <div className="details-row">
                <span>Name</span>
                <span>{event.title}</span>
              </div>
              <div className="details-row">
                <span>Type</span>
                <span>{event.eventType}</span>
              </div>
              <div className="details-row">
                <span>Status</span>
                <span>{statusLabel}</span>
              </div>
              <div className="details-row">
                <span>Dates</span>
                <span>
                  {formatDate(event.startDate)} - {formatDate(event.endDate)}
                </span>
              </div>
              <div className="details-row">
                <span>Eligibility</span>
                <span>{event.eligibility}</span>
              </div>
              {event.eventType === "normal" && (
                <div className="details-row">
                  <span>Pricing</span>
                  <span>INR {event.registrationFee || 0}</span>
                </div>
              )}
              <div className="details-row">
                <span>Venue</span>
                <span>{event.venue || "-"}</span>
              </div>
              {event.eventType === "normal" && (
                <div className="details-row">
                  <span>Total Prize Money</span>
                  <span>INR {Number(event.totalPrizeMoney || 0).toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>
          </section>

          {event.status === "draft" ? (
            <section className="event-section">
              <div className="section-header">
                <h3>Edit Draft</h3>
                <p>Draft events can be edited before publishing.</p>
              </div>

              {editForm && (
                <form className="draft-form" onSubmit={saveDraft}>
                  <label>
                    Title
                    <input
                      value={editForm.title}
                      onChange={onEditChange("title")}
                      required
                    />
                  </label>

                  <label>
                    Description
                    <textarea
                      value={editForm.description}
                      onChange={onEditChange("description")}
                      required
                      rows={4}
                    />
                  </label>

                  {editForm.eventType === "normal" && (
                    <div className="draft-grid">
                      <label>
                        Venue
                        <input
                          value={editForm.venue || ""}
                          onChange={onEditChange("venue")}
                          placeholder="eg. H105"
                        />
                      </label>

                      <label>
                        Total Prize Money (INR)
                        <input
                          type="number"
                          min={0}
                          className="no-spinner"
                          value={editForm.totalPrizeMoney}
                          onChange={onEditChange("totalPrizeMoney")}
                          placeholder="Enter prize money"
                        />
                      </label>
                    </div>
                  )}

                  <div className="draft-grid">
                    <label>
                      Category
                      <select value={editForm.category} onChange={onEditChange("category")}>
                        <option value="Technical">Technical</option>
                        <option value="Cultural">Cultural</option>
                        <option value="Sports">Sports</option>
                        <option value="Other">Other</option>
                        <option value="Merchandise">Merchandise</option>
                      </select>
                    </label>

                    <label>
                      Event Type
                      <select value={editForm.eventType} onChange={onEditChange("eventType")}>
                        <option value="normal">Normal</option>
                        <option value="merchandise">Merchandise</option>
                      </select>
                    </label>

                    <label>
                      Eligibility
                      <select value={editForm.eligibility} onChange={onEditChange("eligibility")}>
                        <option value="Both">Both</option>
                        <option value="IIIT">IIIT</option>
                        <option value="Non-IIIT">Non-IIIT</option>
                      </select>
                    </label>
                  </div>

                  {editForm.eventType === "normal" && (
                    <div className="draft-box">
                      <h4>Custom Registration Form</h4>
                      {isFormLocked && (
                        <p className="draft-message">
                          Form is locked after first registration. You can still edit other draft details.
                        </p>
                      )}
                      <div className="draft-stack">
                        {editRegistrationFormFields.map((field, idx) => (
                          <div key={idx} className="draft-field">
                            <label>
                              Key
                              <input
                                value={field.key}
                                disabled={isFormLocked}
                                onChange={(e) =>
                                  setEditRegistrationFormFields((prev) =>
                                    prev.map((x, i) =>
                                      i === idx ? { ...x, key: e.target.value } : x
                                    )
                                  )
                                }
                              />
                            </label>
                            <label>
                              Label
                              <input
                                value={field.label}
                                disabled={isFormLocked}
                                onChange={(e) =>
                                  setEditRegistrationFormFields((prev) =>
                                    prev.map((x, i) =>
                                      i === idx ? { ...x, label: e.target.value } : x
                                    )
                                  )
                                }
                              />
                            </label>
                            <label>
                              Type
                              <select
                                value={field.type}
                                disabled={isFormLocked}
                                onChange={(e) =>
                                  setEditRegistrationFormFields((prev) =>
                                    prev.map((x, i) =>
                                      i === idx ? { ...x, type: e.target.value } : x
                                    )
                                  )
                                }
                              >
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="select">Select</option>
                                <option value="checkbox">Checkbox</option>
                                <option value="file">File Upload</option>
                                <option value="textarea">Textarea</option>
                                <option value="date">Date</option>
                              </select>
                            </label>

                            {field.type === "select" && (
                              <label>
                                Options (comma-separated)
                                <input
                                  value={(field.options || []).join(", ")}
                                  disabled={isFormLocked}
                                  onChange={(e) =>
                                    setEditRegistrationFormFields((prev) =>
                                      prev.map((x, i) =>
                                        i === idx
                                          ? {
                                              ...x,
                                              options: String(e.target.value)
                                                .split(",")
                                                .map((s) => s.trim())
                                                .filter(Boolean),
                                            }
                                          : x
                                      )
                                    )
                                  }
                                />
                              </label>
                            )}

                            <label className="draft-checkbox">
                              <input
                                type="checkbox"
                                checked={!!field.required}
                                disabled={isFormLocked}
                                onChange={(e) =>
                                  setEditRegistrationFormFields((prev) =>
                                    prev.map((x, i) =>
                                      i === idx ? { ...x, required: e.target.checked } : x
                                    )
                                  )
                                }
                              />
                              Required
                            </label>

                            <button
                              type="button"
                              disabled={isFormLocked}
                              onClick={() =>
                                setEditRegistrationFormFields((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                            >
                              Remove Field
                            </button>

                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                disabled={isFormLocked || idx === 0}
                                onClick={() => moveEditRegistrationField(idx, "up")}
                              >
                                Move Up
                              </button>
                              <button
                                type="button"
                                disabled={isFormLocked || idx === editRegistrationFormFields.length - 1}
                                onClick={() => moveEditRegistrationField(idx, "down")}
                              >
                                Move Down
                              </button>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          disabled={isFormLocked}
                          onClick={() =>
                            setEditRegistrationFormFields((prev) => [
                              ...prev,
                              { key: "", label: "", type: "text", required: false, options: [] },
                            ])
                          }
                        >
                          Add Field
                        </button>
                      </div>
                    </div>
                  )}

                  {editForm.eventType === "merchandise" && (
                    <div className="draft-box">
                      <h4>Merchandise Items</h4>
                      <div className="draft-stack">
                        {editMerchandiseItems.map((item, itemIdx) => (
                          <div key={itemIdx} className="draft-field">
                            <div className="draft-grid">
                              <label>
                                Item Name
                                <input
                                  value={item.name}
                                  onChange={(e) =>
                                    setEditMerchandiseItems((prev) =>
                                      prev.map((x, i) =>
                                        i === itemIdx ? { ...x, name: e.target.value } : x
                                      )
                                    )
                                  }
                                />
                              </label>

                              <label>
                                Item Price (INR)
                                <input
                                  type="number"
                                  min={0}
                                  className="no-spinner"
                                  value={item.itemPrice ?? ""}
                                  onChange={(e) =>
                                    setEditMerchandiseItems((prev) =>
                                      prev.map((x, i) =>
                                        i === itemIdx
                                          ? {
                                              ...x,
                                              itemPrice: e.target.value,
                                            }
                                          : x
                                      )
                                    )
                                  }
                                  placeholder="eg. 500"
                                />
                              </label>
                            </div>

                            <div className="draft-variants">
                              {(item.variants || []).map((variant, vIdx) => (
                                <div key={vIdx} className="draft-variant">
                                  <label>
                                    Size
                                    <input
                                      value={variant.size}
                                      onChange={(e) =>
                                        setEditMerchandiseItems((prev) =>
                                          prev.map((x, i) => {
                                            if (i !== itemIdx) return x;
                                            const variants = (x.variants || []).map((vv, j) =>
                                              j === vIdx ? { ...vv, size: e.target.value } : vv
                                            );
                                            return { ...x, variants };
                                          })
                                        )
                                      }
                                    />
                                  </label>
                                  <label>
                                    Color
                                    <input
                                      value={variant.color}
                                      onChange={(e) =>
                                        setEditMerchandiseItems((prev) =>
                                          prev.map((x, i) => {
                                            if (i !== itemIdx) return x;
                                            const variants = (x.variants || []).map((vv, j) =>
                                              j === vIdx ? { ...vv, color: e.target.value } : vv
                                            );
                                            return { ...x, variants };
                                          })
                                        )
                                      }
                                    />
                                  </label>
                                  <label>
                                    Stock
                                    <input
                                      type="number"
                                      min={0}
                                      value={variant.stock}
                                      onChange={(e) =>
                                        setEditMerchandiseItems((prev) =>
                                          prev.map((x, i) => {
                                            if (i !== itemIdx) return x;
                                            const variants = (x.variants || []).map((vv, j) =>
                                              j === vIdx
                                                ? { ...vv, stock: Number(e.target.value) }
                                                : vv
                                            );
                                            return { ...x, variants };
                                          })
                                        )
                                      }
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="btn-danger"
                                    onClick={() =>
                                      setEditMerchandiseItems((prev) =>
                                        prev.map((x, i) => {
                                          if (i !== itemIdx) return x;
                                          return {
                                            ...x,
                                            variants: (x.variants || []).filter((_, j) => j !== vIdx),
                                          };
                                        })
                                      )
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}

                              <button
                                type="button"
                                onClick={() =>
                                  setEditMerchandiseItems((prev) =>
                                    prev.map((x, i) => {
                                      if (i !== itemIdx) return x;
                                      return {
                                        ...x,
                                        variants: [
                                          ...(x.variants || []),
                                          { size: "", color: "", stock: 0 },
                                        ],
                                      };
                                    })
                                  )
                                }
                              >
                                Add Variant
                              </button>
                            </div>

                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() =>
                                setEditMerchandiseItems((prev) =>
                                  prev.filter((_, i) => i !== itemIdx)
                                )
                              }
                            >
                              Remove Item
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            setEditMerchandiseItems((prev) => [
                              ...prev,
                              {
                                name: "",
                                itemPrice: "",
                                variants: [{ size: "", color: "", stock: 0 }],
                              },
                            ])
                          }
                        >
                          Add Item
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="draft-grid">
                    <label>
                      Registration Deadline
                      <input
                        type="datetime-local"
                        value={editForm.registrationDeadline}
                        onChange={onEditChange("registrationDeadline")}
                        required
                      />
                    </label>

                    <label>
                      Start Date
                      <input
                        type="datetime-local"
                        value={editForm.startDate}
                        onChange={onEditChange("startDate")}
                        required
                      />
                    </label>

                    <label>
                      End Date
                      <input
                        type="datetime-local"
                        value={editForm.endDate}
                        onChange={onEditChange("endDate")}
                        required
                      />
                    </label>
                  </div>

                  <div className="draft-grid">
                    <label>
                      Registration Limit
                      <input
                        type="number"
                        min={1}
                        value={editForm.registrationLimit}
                        onChange={onEditChange("registrationLimit")}
                        required
                      />
                    </label>

                    {editForm.eventType === "normal" && (
                      <label>
                        Registration Fee
                        <input
                          type="number"
                          min={0}
                          className="no-spinner"
                          value={editForm.registrationFee}
                          onChange={onEditChange("registrationFee")}
                          placeholder="Enter registration fee"
                        />
                      </label>
                    )}
                  </div>

                  <div className="draft-actions">
                    <button type="submit" disabled={savingDraft}>
                      {savingDraft ? "Saving..." : "Save Draft"}
                    </button>
                    <button
                      type="button"
                      onClick={publishDraft}
                      disabled={actionBusy === "publish"}
                    >
                      {actionBusy === "publish" ? "Publishing..." : "Publish"}
                    </button>
                    {draftMessage && <span className="draft-message">{draftMessage}</span>}
                    {actionMessage && <span className="draft-message">{actionMessage}</span>}
                  </div>
                </form>
              )}
            </section>
          ) : (
            <>
              {lifecycleStatus === "published" && (
                <section className="event-section">
                  <div className="section-header">
                    <h3>Published Event Actions</h3>
                    <p>Update description, extend deadline, increase limit, or close registrations.</p>
                  </div>

                  <form className="draft-form" onSubmit={savePublishedUpdates}>
                    <label>
                      Description
                      <textarea
                        rows={4}
                        value={publishedEdit.description}
                        onChange={(e) =>
                          setPublishedEdit((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    {event.eventType === "normal" && (
                      <div className="draft-grid">
                        <label>
                          Venue
                          <input
                            value={publishedEdit.venue || ""}
                            onChange={(e) =>
                              setPublishedEdit((prev) => ({
                                ...prev,
                                venue: e.target.value,
                              }))
                            }
                            placeholder="eg. H105"
                          />
                        </label>

                        <label>
                          Total Prize Money (INR)
                          <input
                            type="number"
                            min={0}
                            className="no-spinner"
                            value={publishedEdit.totalPrizeMoney}
                            onChange={(e) =>
                              setPublishedEdit((prev) => ({
                                ...prev,
                                totalPrizeMoney: e.target.value,
                              }))
                            }
                            placeholder="Enter prize money"
                          />
                        </label>
                      </div>
                    )}

                    <div className="draft-grid">
                      <label>
                        Registration Deadline (Extend Only)
                        <input
                          type="datetime-local"
                          value={publishedEdit.registrationDeadline}
                          onChange={(e) =>
                            setPublishedEdit((prev) => ({
                              ...prev,
                              registrationDeadline: e.target.value,
                            }))
                          }
                          required
                        />
                      </label>

                      <label>
                        Registration Limit (Increase Only)
                        <input
                          type="number"
                          min={1}
                          value={publishedEdit.registrationLimit}
                          onChange={(e) =>
                            setPublishedEdit((prev) => ({
                              ...prev,
                              registrationLimit: Number(e.target.value),
                            }))
                          }
                          required
                        />
                      </label>
                    </div>

                    <div className="draft-actions">
                      <button type="submit" disabled={actionBusy === "published-update"}>
                        {actionBusy === "published-update" ? "Saving..." : "Save Updates"}
                      </button>
                      <button
                        type="button"
                        onClick={closeEventRegistrations}
                        disabled={event.registrationsClosed || actionBusy === "close-registrations"}
                      >
                        {event.registrationsClosed
                          ? "Registrations Closed"
                          : actionBusy === "close-registrations"
                            ? "Closing..."
                            : "Close Registrations"}
                      </button>
                      {actionMessage && <span className="draft-message">{actionMessage}</span>}
                    </div>
                  </form>
                </section>
              )}

              {(lifecycleStatus === "ongoing" || lifecycleStatus === "completed") && (
                <section className="event-section">
                  <div className="section-header">
                    <h3>Status Actions</h3>
                    <p>Ongoing and completed events support status-only updates.</p>
                  </div>

                  <div className="draft-actions">
                    {lifecycleStatus === "ongoing" && (
                      <button
                        type="button"
                        onClick={completeEventStatus}
                        disabled={actionBusy === "complete-event"}
                      >
                        {actionBusy === "complete-event" ? "Updating..." : "Mark Completed"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={closeEventStatus}
                      disabled={actionBusy === "close-event"}
                    >
                      {actionBusy === "close-event" ? "Closing..." : "Mark Closed"}
                    </button>
                    {actionMessage && <span className="draft-message">{actionMessage}</span>}
                  </div>
                </section>
              )}

              <section className="event-section">
                <div className="section-header">
                  <h3>Analytics</h3>
                  <p>
                    {event.eventType === "merchandise"
                      ? "Merchandise registrations, attendance, and total sales."
                      : "Registration and attendance overview."}
                  </p>
                </div>

                <div className="analytics-table">
                  <div className="analytics-row">
                    <span>Registrations</span>
                    <span>
                      {analyticsSummary.registrations} / {analyticsSummary.registrationLimit || "-"}
                    </span>
                  </div>
                  <div className="analytics-row">
                    <span>Attendance (Present)</span>
                    <span>{analyticsSummary.present}</span>
                  </div>
                  <div className="analytics-row">
                    <span>Attendance (Absent)</span>
                    <span>{analyticsSummary.absent}</span>
                  </div>
                  {event.eventType === "merchandise" && (
                    <div className="analytics-row">
                      <span>Revenue</span>
                      <span>
                        INR {Math.max(0, analyticsSummary.totalRevenue).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <section className="event-section">
                <div className="section-header">
                  <h3>QR Attendance</h3>
                  <p>Upload a participant ticket QR image to mark attendance instantly.</p>
                </div>

                <div className="qr-attendance-grid">
                  <div className="qr-upload-card">
                    <label htmlFor="qr-attendance-file">Ticket QR Image</label>
                    <input
                      id="qr-attendance-file"
                      type="file"
                      accept="image/*"
                      onChange={handleQrUploadScan}
                      disabled={qrScanBusy}
                    />
                    <span>
                      {qrScanBusy
                        ? "Scanning uploaded QR image..."
                        : "Supported: PNG, JPG, JPEG, WEBP"}
                    </span>
                  </div>

                  <div className="qr-summary-card">
                    <h4>Live Attendance Snapshot</h4>
                    <div className="qr-summary-row">
                      <span>Scanned</span>
                      <strong>{attendanceSnapshot.present}</strong>
                    </div>
                    <div className="qr-summary-row">
                      <span>Not Yet Scanned</span>
                      <strong>{attendanceSnapshot.pending}</strong>
                    </div>
                    <div className="qr-summary-row">
                      <span>Total</span>
                      <strong>{attendanceSnapshot.total}</strong>
                    </div>
                  </div>
                </div>

                {qrScanNotice.text && (
                  <p className={`qr-scan-message ${qrScanNotice.type}`}>{qrScanNotice.text}</p>
                )}
              </section>

              <section className="event-section">
                <div className="section-header">
                  <h3>Participants</h3>
                  <p>Search, filter, and export registration data.</p>
                </div>

                <div className="participants-toolbar">
                  <input
                    type="text"
                    placeholder="Search by name or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {isOrganizerView && (
                    <input
                      type="text"
                      className="participants-reason-input"
                      placeholder="Reason (optional) for manual override"
                      value={attendanceReason}
                      onChange={(e) => setAttendanceReason(e.target.value)}
                    />
                  )}
                  <button type="button" onClick={exportCsv}>
                    Export CSV
                  </button>
                </div>

                <div className="participants-table">
                  <div className="participants-header">
                    <span>Name</span>
                    <span>Email</span>
                    <span>Reg Date</span>
                    <span>Payment</span>
                    <span>Team</span>
                    <span>Attendance</span>
                  </div>

                  {filteredParticipants.map((row) => (
                    <div key={row.id} className="participants-row">
                      <span>{row.name}</span>
                      <span>{row.email}</span>
                      <span>{row.regDate}</span>
                      <span>{row.payment}</span>
                      <span>{row.team}</span>
                      <span>
                        {row.attendance}
                        {isOrganizerView && (
                          <button
                            type="button"
                            style={{ marginLeft: 8 }}
                            disabled={attendanceBusyId === String(row.id)}
                            onClick={() =>
                              updateParticipantAttendance(
                                row.id,
                                !row.attended,
                                attendanceReason
                              )
                            }
                          >
                            {attendanceBusyId === String(row.id)
                              ? "Saving..."
                              : row.attended
                                ? "Mark Absent"
                                : "Mark Present"}
                          </button>
                        )}
                      </span>
                    </div>
                  ))}

                  {filteredParticipants.length === 0 && (
                    <div className="participants-empty">No participants found.</div>
                  )}
                </div>

                {organizerMessage && <p className="event-message">{organizerMessage}</p>}
              </section>

              {renderDiscussionSection()}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="event-meta">
            Category: {event.category} • Eligibility: {event.eligibility} • Type: {event.eventType}
          </div>

          <div className="event-meta">
            Registrations: {registrationCount}/{registrationLimit || "-"}
          </div>

          {lifecycleStatus === "published" && (
            <div className="event-meta">
              Registration Deadline: {formatDate(event.registrationDeadline)}
            </div>
          )}

          <div className="event-meta">
            Venue: {event.venue || "-"}
            {event.eventType === "normal"
              ? ` • Prize Pool: INR ${Number(event.totalPrizeMoney || 0).toLocaleString("en-IN")}`
              : ""}
          </div>

          <p className="event-description">{event.description}</p>

          {!registered && event?.eventType === "normal" && (
            <div style={{ marginTop: 16 }}>
              {Array.isArray(event.registrationFormFields) &&
              event.registrationFormFields.length > 0 ? (
                <>
                  <h3 style={{ marginBottom: 8 }}>Registration Form</h3>
                  <div style={{ display: "grid", gap: 10 }}>
                    {event.registrationFormFields.map((field) => {
                      const key = field.key;
                      const label = field.label || key;
                      const required = !!field.required;
                      const value = formResponses[key] ?? "";

                      if (field.type === "select") {
                        return (
                          <label key={key} style={{ display: "grid", gap: 6 }}>
                            {label} {required ? "*" : ""}
                            <select
                              value={value}
                              onChange={(e) =>
                                setFormResponses((p) => ({ ...p, [key]: e.target.value }))
                              }
                            >
                              <option value="">Select</option>
                              {(field.options || []).map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      }

                      if (field.type === "number") {
                        return (
                          <label key={key} style={{ display: "grid", gap: 6 }}>
                            {label} {required ? "*" : ""}
                            <input
                              type="number"
                              value={value}
                              onChange={(e) =>
                                setFormResponses((p) => ({ ...p, [key]: e.target.value }))
                              }
                            />
                          </label>
                        );
                      }

                      if (field.type === "checkbox") {
                        return (
                          <label key={key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(e) =>
                                setFormResponses((p) => ({ ...p, [key]: e.target.checked }))
                              }
                            />
                            {label} {required ? "*" : ""}
                          </label>
                        );
                      }

                      if (field.type === "file") {
                        const fileValue = value && typeof value === "object" ? value : null;
                        return (
                          <label key={key} style={{ display: "grid", gap: 6 }}>
                            {label} {required ? "*" : ""}
                            <input
                              type="file"
                              onChange={(e) => onFileFieldChange(key, e.target.files?.[0] || null)}
                            />
                            {fileValue?.name && (
                              <span style={{ opacity: 0.8 }}>Selected: {fileValue.name}</span>
                            )}
                          </label>
                        );
                      }

                      if (field.type === "textarea") {
                        return (
                          <label key={key} style={{ display: "grid", gap: 6 }}>
                            {label} {required ? "*" : ""}
                            <textarea
                              rows={3}
                              value={value}
                              onChange={(e) =>
                                setFormResponses((p) => ({ ...p, [key]: e.target.value }))
                              }
                            />
                          </label>
                        );
                      }

                      if (field.type === "date") {
                        return (
                          <label key={key} style={{ display: "grid", gap: 6 }}>
                            {label} {required ? "*" : ""}
                            <input
                              type="date"
                              value={value}
                              onChange={(e) =>
                                setFormResponses((p) => ({ ...p, [key]: e.target.value }))
                              }
                            />
                          </label>
                        );
                      }

                      return (
                        <label key={key} style={{ display: "grid", gap: 6 }}>
                          {label} {required ? "*" : ""}
                          <input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              setFormResponses((p) => ({ ...p, [key]: e.target.value }))
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p style={{ opacity: 0.8, marginTop: 0 }}>
                  No additional registration fields.
                </p>
              )}
            </div>
          )}

          {!registered && event?.eventType === "merchandise" && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Merchandise Selection</h3>

              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  Item
                  <select
                    value={selectedItemIndex}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setSelectedItemIndex(next);
                      setSelectedVariantIndex(0);
                    }}
                  >
                    {(event.merchandiseItems || []).map((item, idx) => (
                      <option key={idx} value={idx}>
                        {item.name} (INR {Number(item.itemPrice || 0).toLocaleString("en-IN")})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  Variant
                  <select
                    value={selectedVariantIndex}
                    onChange={(e) => setSelectedVariantIndex(Number(e.target.value))}
                  >
                    {(event.merchandiseItems?.[selectedItemIndex]?.variants || []).map(
                      (variant, idx) => {
                        const name =
                          [variant.size, variant.color].filter(Boolean).join(" / ") ||
                          `Variant ${idx + 1}`;
                        return (
                          <option key={idx} value={idx}>
                            {name} (Stock: {variant.stock})
                          </option>
                        );
                      }
                    )}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  Quantity
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </label>

                <div style={{ color: "#94a3b8", fontSize: 14 }}>
                  Price: INR {Math.max(0, selectedItemPrice).toLocaleString("en-IN")} each
                  {Number.isFinite(selectedTotalPrice)
                    ? ` • Total: INR ${selectedTotalPrice.toLocaleString("en-IN")}`
                    : ""}
                </div>
              </div>
            </div>
          )}

          <div className="event-actions">
            {!registered ? (
              <button onClick={handleRegister} disabled={disableRegister}>
                {event?.eventType === "merchandise" ? "Purchase" : "Register"}
              </button>
            ) : (
              <div className="registered-badge">✅ You are registered</div>
            )}
          </div>

          {registered && isParticipantView && (
            <div className="calendar-actions">
              <span>Add to Calendar</span>
              <button type="button" onClick={downloadIcs}>
                Download .ics
              </button>
              <button
                type="button"
                onClick={() => openCalendarLink(buildGoogleCalendarUrl(event))}
              >
                Google Calendar
              </button>
              <button
                type="button"
                onClick={() => openCalendarLink(buildOutlookCalendarUrl(event))}
              >
                Outlook (Web)
              </button>
              {lifecycleStatus === "published" && (
                <button
                  type="button"
                  onClick={handleCancelRegistration}
                  disabled={cancelBusy}
                >
                  {cancelBusy ? "Cancelling..." : "Cancel Registration"}
                </button>
              )}
            </div>
          )}

          {registered && ticketInfo && (
            <div className="event-actions" style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span>Ticket ID: {ticketInfo.ticketId}</span>
                {ticketInfo.qrDataUrl && (
                  <img
                    src={ticketInfo.qrDataUrl}
                    alt="Ticket QR"
                    style={{ width: 110, height: 110, borderRadius: 8, border: "1px solid #1e293b" }}
                  />
                )}
                {ticketInfo.qrDataUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadDataUrl(ticketInfo.qrDataUrl, `ticket-${ticketInfo.ticketId}.png`)
                    }
                  >
                    Download QR (PNG)
                  </button>
                )}
                {ticketInfo.ticketDbId && (
                  <button type="button" onClick={() => downloadPdf(ticketInfo.ticketDbId)}>
                    Download Ticket (PDF)
                  </button>
                )}
              </div>
            </div>
          )}

          {blockReason && <p className="event-message">{blockReason}</p>}
          {message && <p className="event-message">{message}</p>}

          {renderDiscussionSection()}
        </>
      )}
    </div>
  );
}
