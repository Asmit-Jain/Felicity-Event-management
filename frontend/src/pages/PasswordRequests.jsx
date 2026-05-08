import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import "./PasswordRequests.css";

export default function PasswordRequests() {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("approve");
  const [modalComment, setModalComment] = useState("");
  const [activeRequest, setActiveRequest] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await api.get("/admin/password-requests");
        if (!active) return;
        setRequests(res.data || []);
        setMessage("");
      } catch (e) {
        if (!active) return;
        setMessage(e.response?.data?.message || "Failed to load requests");
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);
  const reload = async () => {
    try {
      const res = await api.get("/admin/password-requests");
      setRequests(res.data || []);
    } catch (e) {
      setMessage(e.response?.data?.message || "Failed to load requests");
    }
  };
  const openModal = (type, request) => {
    setModalType(type);
    setActiveRequest(request);
    setModalComment("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (actionBusy) return;
    setModalOpen(false);
    setActiveRequest(null);
    setModalComment("");
  };

  const submitAction = async () => {
    if (!activeRequest) return;
    setActionBusy(true);
    setMessage("");
    try {
      if (modalType === "approve") {
        const res = await api.put(
          `/admin/password-requests/${activeRequest._id}/complete`,
          { adminComment: modalComment }
        );
        const newPassword = res.data?.newPasswordPlain || res.data?.password;
        if (newPassword) {
          setMessage(`New password for ${res.data.email}: ${newPassword}`);
        } else {
          setMessage("Password reset completed");
        }
      } else {
        await api.put(`/admin/password-requests/${activeRequest._id}/reject`, {
          adminComment: modalComment,
        });
        setMessage("Password reset request rejected");
      }
      await reload();
      closeModal();
    } catch (e) {
      setMessage(e.response?.data?.message || "Action failed");
    } finally {
      setActionBusy(false);
    }
  };

  const statusLabel = (status) => {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return "Pending";
  };

  const rows = useMemo(() => requests || [], [requests]);
  return (
    <div className="password-requests-page">
      <div className="password-requests-header">
        <div>
          <h2>Password Reset Requests</h2>
          <p>Review organizer requests, then approve or reject with comments.</p>
        </div>
      </div>

      {message && <p className="password-requests-message">{message}</p>}

      <div className="password-requests-table">
        <div className="password-requests-row password-requests-head">
          <span>Club Name</span>
          <span>Organizer Email</span>
          <span>Role</span>
          <span>Reason</span>
          <span>Status</span>
          <span>Requested</span>
          <span>Actions</span>
        </div>

        {rows.map((req) => {
          const status = req.status || "pending";
          const isPending = status === "pending";
          return (
            <div key={req._id} className="password-requests-row">
              <span>{req.clubName || "-"}</span>
              <span>{req.user?.email || req.email || "-"}</span>
              <span>{req.role || "-"}</span>
              <span>{req.reason || "-"}</span>
              <span className={`request-status status-${status}`}>
                {statusLabel(status)}
              </span>
              <span>
                {req.createdAt ? new Date(req.createdAt).toLocaleString() : "-"}
              </span>
              <span>
                {isPending ? (
                  <div className="request-actions">
                    <button type="button" onClick={() => openModal("approve", req)}>
                      Approve
                    </button>
                    <button type="button" onClick={() => openModal("reject", req)}>
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="request-meta">
                    <div>
                      {req.handledAt
                        ? `Handled: ${new Date(req.handledAt).toLocaleString()}`
                        : "Handled"}
                    </div>
                    <div>{req.adminComment || "No comment"}</div>
                  </div>
                )}
              </span>
            </div>
          );
        })}

        {rows.length === 0 && (
          <p className="password-requests-empty">No requests yet.</p>
        )}
      </div>

      {modalOpen && (
        <div className="password-modal-backdrop" onClick={closeModal}>
          <div className="password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="password-modal-header">
              <div>
                <h3>{modalType === "approve" ? "Approve Request" : "Reject Request"}</h3>
                <p>{activeRequest?.clubName || activeRequest?.user?.email || ""}</p>
              </div>
              <button type="button" onClick={closeModal}>
                Close
              </button>
            </div>
            <textarea
              rows={4}
              value={modalComment}
              onChange={(e) => setModalComment(e.target.value)}
              placeholder="Add an admin comment (optional)"
            />
            <div className="password-modal-actions">
              <button type="button" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" onClick={submitAction} disabled={actionBusy}>
                {actionBusy ? "Saving..." : modalType === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
