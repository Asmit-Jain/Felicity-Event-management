import { useEffect, useState } from "react";
import api from "../api/axios";
import "./AdminOrganizers.css";

export default function AdminOrganizers() {
  const getOrganizerLabel = (org) => {
    const rawName = String(org.organizerName || "").trim();
    if (rawName) return rawName;

    const fullName = `${org.firstName || ""} ${org.lastName || ""}`.trim();
    if (fullName) return fullName;

    const email = String(org.email || "").trim();
    if (!email) return "Unknown Organizer";
    return email.split("@")[0] || email;
  };
  const [tab, setTab] = useState("add");
  const [organizers, setOrganizers] = useState([]);
  const [message, setMessage] = useState("");
  const [createdCreds, setCreatedCreds] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyOrganizer, setHistoryOrganizer] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState({
    organizerName: "",
    organizerCategory: "Technical",
    organizerDescription: "",
    organizerContactEmail: "",
  });

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const res = await api.get("/admin/organizers");
        if (!active) return;
        setOrganizers(res.data || []);
        setMessage("");
      } catch (e) {
        if (!active) return;
        setMessage(e.response?.data?.message || "Failed to load organizers");
      }
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  const reload = async () => {
    try {
      const res = await api.get("/admin/organizers");
      setOrganizers(res.data || []);
    } catch (e) {
      setMessage(e.response?.data?.message || "Failed to load organizers");
    }
  };

  const onChange = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    setMessage("");
    setCreatedCreds(null);
    try {
      const res = await api.post("/admin/organizers", form);
      setCreatedCreds(res.data);
      await reload();
      setForm({
        organizerName: "",
        organizerCategory: "Technical",
        organizerDescription: "",
        organizerContactEmail: "",
      });
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to create organizer");
    }
  };

  const disable = async (id) => {
    setMessage("");
    try {
      await api.put(`/admin/organizers/${id}/disable`);
      await reload();
    } catch (e) {
      setMessage(e.response?.data?.message || "Failed to disable organizer");
    }
  };

  const enable = async (id) => {
    setMessage("");
    try {
      await api.put(`/admin/organizers/${id}/enable`);
      await reload();
    } catch (e) {
      setMessage(e.response?.data?.message || "Failed to enable organizer");
    }
  };

  const archive = async (id) => {
    if (!window.confirm("Archive this organizer? They will be disabled.")) return;
    setMessage("");
    try {
      await api.put(`/admin/organizers/${id}/archive`);
      await reload();
    } catch (e) {
      setMessage(e.response?.data?.message || "Failed to archive organizer");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Permanently delete this organizer?")) return;
    setMessage("");
    try {
      await api.delete(`/admin/organizers/${id}`);
      await reload();
    } catch (e) {
      setMessage(e.response?.data?.message || "Failed to delete organizer");
    }
  };

  const copyToClipboard = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied to clipboard");
    } catch {
      setMessage("Copy failed. Please copy manually.");
    }
  };

  const openHistory = async (org) => {
    setHistoryOrganizer(org);
    setHistoryItems([]);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/admin/organizers/${org._id}/password-resets`);
      setHistoryItems(res.data || []);
      setHistoryLoading(false);
    } catch (e) {
      setMessage(e.response?.data?.message || "Failed to load history");
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryOrganizer(null);
    setHistoryItems([]);
    setHistoryLoading(false);
  };

  return (
    <div className="admin-org-page">
      <div className="admin-org-header">
        <h2>Manage Clubs/Organizers</h2>
        {message && <p className="admin-org-message">{message}</p>}
      </div>

      <div className="admin-org-tabs">
        <button
          type="button"
          className={tab === "add" ? "active" : ""}
          onClick={() => setTab("add")}
        >
          Add New Organizer
        </button>
        <button
          type="button"
          className={tab === "manage" ? "active" : ""}
          onClick={() => setTab("manage")}
        >
          Manage Organizers
        </button>
      </div>

      {tab === "add" && (
        <section className="admin-org-card">
          <div className="section-title">
            <h3>Add New Organizer</h3>
            <p>Create a new club/organizer account and share credentials.</p>
          </div>

          <form onSubmit={create} className="admin-org-form">
            <div className="admin-org-grid">
              <label>
                Organizer Name
                <input
                  value={form.organizerName}
                  onChange={onChange("organizerName")}
                  required
                />
              </label>

              <label>
                Organizer Category
                <select
                  value={form.organizerCategory}
                  onChange={onChange("organizerCategory")}
                >
                  <option value="Technical">Technical</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Sports">Sports</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            <label>
              Description
              <textarea
                value={form.organizerDescription}
                onChange={onChange("organizerDescription")}
                rows={4}
                placeholder="Describe the club or organizer"
              />
            </label>

            <label>
              Contact Email (public)
              <input
                value={form.organizerContactEmail}
                onChange={onChange("organizerContactEmail")}
                placeholder="club@example.com"
              />
            </label>

            <button type="submit" className="btn-primary">
              Create Organizer
            </button>
          </form>

          {createdCreds && (
            <div className="admin-org-creds">
              <strong>Share these login credentials with the organizer:</strong>
              <div>Login Email: {createdCreds.loginEmail}</div>
              <div>Password: {createdCreds.password}</div>
              <div className="admin-org-actions">
                <button type="button" onClick={() => copyToClipboard(createdCreds.loginEmail)}>
                  Copy Email
                </button>
                <button type="button" onClick={() => copyToClipboard(createdCreds.password)}>
                  Copy Password
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "manage" && (
        <section className="admin-org-card">
          <div className="section-title">
            <h3>All Organizers</h3>
            <p>View status and manage access for each club.</p>
          </div>

          <div className="admin-org-table">
            <div className="admin-org-table-header">
              <span>Organizer</span>
              <span>Email</span>
              <span>Category</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {organizers.map((org) => (
              <div key={org._id} className="admin-org-row">
                <span className="org-title">{getOrganizerLabel(org)}</span>
                <span>{org.email}</span>
                <span>{org.organizerCategory || "-"}</span>
                <span className={org.isActive ? "status-active" : "status-disabled"}>
                  {org.isActive ? "Active" : "Disabled"}
                </span>
                <div className="admin-org-actions">
                  {org.isActive ? (
                    <button type="button" onClick={() => disable(org._id)}>
                      Disable
                    </button>
                  ) : (
                    <button type="button" onClick={() => enable(org._id)}>
                      Enable
                    </button>
                  )}
                  <button type="button" onClick={() => openHistory(org)}>
                    Reset History
                  </button>
                  <button type="button" onClick={() => archive(org._id)}>
                    Archive
                  </button>
                  <button type="button" className="btn-danger" onClick={() => remove(org._id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {organizers.length === 0 && <p className="admin-org-empty">No organizers yet.</p>}
          </div>
        </section>
      )}

      {historyOpen && (
        <div className="reset-history-backdrop" onClick={closeHistory}>
          <div className="reset-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reset-history-header">
              <div>
                <h4>Reset History</h4>
                <p>{getOrganizerLabel(historyOrganizer || {})}</p>
              </div>
              <button type="button" onClick={closeHistory}>
                Close
              </button>
            </div>

            {historyLoading ? (
              <p className="reset-history-empty">Loading history...</p>
            ) : historyItems.length === 0 ? (
              <p className="reset-history-empty">No reset history found.</p>
            ) : (
              <div className="reset-history-table">
                <div className="reset-history-row reset-history-head">
                  <span>Date</span>
                  <span>Status</span>
                  <span>Reason</span>
                  <span>Admin Comment</span>
                </div>
                {historyItems.map((item) => (
                  <div key={item._id} className="reset-history-row">
                    <span>
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
                    </span>
                    <span className={`reset-status reset-${item.status || "pending"}`}>
                      {item.status || "pending"}
                    </span>
                    <span>{item.reason || "-"}</span>
                    <span>{item.adminComment || "-"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
