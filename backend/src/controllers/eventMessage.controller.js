import Event from "../models/Event.js";
import EventMessage from "../models/EventMessage.js";
import EventMessageRead from "../models/EventMessageRead.js";
import Registration from "../models/Registration.js";

const canViewOrPost = async ({ event, user }) => {
  if (!event || !user) return false;

  if (user.role === "admin") return true;

  if (user.role === "organizer") {
    return String(event.organizer) === String(user.id);
  }

  if (user.role === "participant") {
    const registered = await Registration.findOne({
      event: event._id,
      participant: user.id,
      status: "registered",
    }).select("_id");
    return Boolean(registered);
  }

  return false;
};

const canModerate = ({ event, user }) => {
  if (!event || !user) return false;
  if (user.role === "admin") return true;
  if (user.role === "organizer") {
    return String(event.organizer) === String(user.id);
  }
  return false;
};

const emitToRoom = (req, eventId, eventName, payload) => {
  const io = req.app?.get("io");
  if (!io) return;
  io.to(`event:${eventId}`).emit(eventName, payload);
};

const toValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getAccessibleEventIds = async (user) => {
  if (!user?.id) return [];

  if (user.role === "admin") {
    const events = await Event.find({}).select("_id");
    return events.map((item) => item._id);
  }

  if (user.role === "organizer") {
    const events = await Event.find({ organizer: user.id }).select("_id");
    return events.map((item) => item._id);
  }

  if (user.role === "participant") {
    const registrations = await Registration.find({
      participant: user.id,
      status: "registered",
    }).select("event");
    return registrations.map((item) => item.event).filter(Boolean);
  }

  return [];
};

export const getEventMessages = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("organizer status");
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const allowed = await canViewOrPost({ event, user: req.user });
    if (!allowed) {
      return res.status(403).json({ message: "Not authorized to view messages" });
    }

    const messages = await EventMessage.find({
      event: event._id,
    })
      .populate("author", "firstName lastName organizerName role")
      .sort({ createdAt: 1 });

    return res.json(messages);
  } catch (error) {
    console.error("Get event messages error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createEventMessage = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("organizer status");
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const allowed = await canViewOrPost({ event, user: req.user });
    if (!allowed) {
      return res.status(403).json({ message: "Not authorized to post messages" });
    }

    const rawContent = String(req.body?.content || "").trim();
    if (!rawContent) {
      return res.status(400).json({ message: "Message content is required" });
    }

    let messageType = "message";
    if (req.user.role !== "participant" && req.body?.type === "announcement") {
      messageType = "announcement";
    }

    const parentMessage = req.body?.parentMessage || null;
    if (parentMessage) {
      const parent = await EventMessage.findOne({
        _id: parentMessage,
        event: event._id,
      }).select("_id");
      if (!parent) {
        return res.status(400).json({ message: "Parent message not found" });
      }
    }

    const created = await EventMessage.create({
      event: event._id,
      author: req.user.id,
      authorRole: req.user.role,
      content: rawContent,
      type: messageType,
      parentMessage,
    });

    const populated = await EventMessage.findById(created._id).populate(
      "author",
      "firstName lastName organizerName role"
    );

    emitToRoom(req, event._id, "event:message:new", populated);
    return res.status(201).json(populated);
  } catch (error) {
    console.error("Create event message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getUnreadMessageSummary = async (req, res) => {
  try {
    const eventIds = await getAccessibleEventIds(req.user);
    if (eventIds.length === 0) {
      return res.json({ totalUnread: 0, events: [] });
    }

    const reads = await EventMessageRead.find({
      user: req.user.id,
      event: { $in: eventIds },
    }).select("event lastReadAt");

    const readMap = new Map(
      reads.map((item) => [String(item.event), item.lastReadAt || new Date(0)])
    );

    const events = await Event.find({ _id: { $in: eventIds } }).select("title");
    const eventsById = new Map(events.map((event) => [String(event._id), event]));

    const summaries = await Promise.all(
      eventIds.map(async (eventId) => {
        const key = String(eventId);
        const lastReadAt = readMap.get(key) || new Date(0);

        const unreadCount = await EventMessage.countDocuments({
          event: eventId,
          deleted: false,
          author: { $ne: req.user.id },
          createdAt: { $gt: lastReadAt },
        });

        if (unreadCount <= 0) {
          return {
            eventId: key,
            title: eventsById.get(key)?.title || "Event",
            unreadCount: 0,
          };
        }

        const latest = await EventMessage.findOne({
          event: eventId,
          deleted: false,
          author: { $ne: req.user.id },
          createdAt: { $gt: lastReadAt },
        })
          .sort({ createdAt: -1 })
          .select("createdAt");

        return {
          eventId: key,
          title: eventsById.get(key)?.title || "Event",
          unreadCount,
          lastMessageAt: latest?.createdAt || null,
        };
      })
    );

    const filtered = summaries
      .filter((item) => item.unreadCount > 0)
      .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

    const totalUnread = filtered.reduce(
      (sum, item) => sum + Number(item.unreadCount || 0),
      0
    );

    return res.json({ totalUnread, events: filtered });
  } catch (error) {
    console.error("Get unread message summary error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const markEventMessagesRead = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("organizer status");
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const allowed = await canViewOrPost({ event, user: req.user });
    if (!allowed) {
      return res.status(403).json({ message: "Not authorized to view messages" });
    }

    const fromBody = toValidDate(req.body?.lastSeenAt);
    const readAt = fromBody || new Date();

    await EventMessageRead.updateOne(
      {
        event: event._id,
        user: req.user.id,
      },
      {
        $max: {
          lastReadAt: readAt,
        },
      },
      {
        upsert: true,
      }
    );

    return res.json({ success: true, lastReadAt: readAt.toISOString() });
  } catch (error) {
    console.error("Mark event messages read error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const pinEventMessage = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("organizer status");
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (!canModerate({ event, user: req.user })) {
      return res.status(403).json({ message: "Not authorized to pin messages" });
    }

    const message = await EventMessage.findOne({
      _id: req.params.messageId,
      event: event._id,
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    message.pinned = true;
    await message.save();

    const populated = await EventMessage.findById(message._id).populate(
      "author",
      "firstName lastName organizerName role"
    );
    emitToRoom(req, event._id, "event:message:update", populated);
    return res.json(populated);
  } catch (error) {
    console.error("Pin message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const unpinEventMessage = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("organizer status");
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (!canModerate({ event, user: req.user })) {
      return res.status(403).json({ message: "Not authorized to unpin messages" });
    }

    const message = await EventMessage.findOne({
      _id: req.params.messageId,
      event: event._id,
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    message.pinned = false;
    await message.save();

    const populated = await EventMessage.findById(message._id).populate(
      "author",
      "firstName lastName organizerName role"
    );
    emitToRoom(req, event._id, "event:message:update", populated);
    return res.json(populated);
  } catch (error) {
    console.error("Unpin message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteEventMessage = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("organizer status");
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (!canModerate({ event, user: req.user })) {
      return res.status(403).json({ message: "Not authorized to delete messages" });
    }

    const message = await EventMessage.findOne({
      _id: req.params.messageId,
      event: event._id,
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    message.deleted = true;
    message.content = "[deleted by moderator]";
    await message.save();

    const populated = await EventMessage.findById(message._id).populate(
      "author",
      "firstName lastName organizerName role"
    );
    emitToRoom(req, event._id, "event:message:delete", populated);
    return res.json(populated);
  } catch (error) {
    console.error("Delete message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const reactToEventMessage = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("organizer status");
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const allowed = await canViewOrPost({ event, user: req.user });
    if (!allowed) {
      return res.status(403).json({ message: "Not authorized to react" });
    }

    const emoji = String(req.body?.emoji || "").trim();
    if (!emoji) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    const message = await EventMessage.findOne({
      _id: req.params.messageId,
      event: event._id,
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.deleted) {
      return res.status(400).json({ message: "Cannot react to a deleted message" });
    }

    const userId = String(req.user.id);
    const existing = message.reactions.find((r) => r.emoji === emoji);
    if (existing) {
      const idx = existing.users.findIndex((u) => String(u) === userId);
      if (idx >= 0) {
        existing.users.splice(idx, 1);
      } else {
        existing.users.push(req.user.id);
      }
      if (existing.users.length === 0) {
        message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      message.reactions.push({ emoji, users: [req.user.id] });
    }

    await message.save();
    const populated = await EventMessage.findById(message._id).populate(
      "author",
      "firstName lastName organizerName role"
    );
    emitToRoom(req, event._id, "event:message:reaction", populated);
    return res.json(populated);
  } catch (error) {
    console.error("React to message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
