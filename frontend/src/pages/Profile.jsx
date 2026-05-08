import { useEffect, useState } from "react";
import api from "../api/axios";
import { removeToken } from "../utils/auth";
import { useNavigate } from "react-router-dom";
import "./Profile.css";

const avatars = [
  "avatar1.png",
  "avatar2.png",
  "avatar3.png",
  "avatar4.png",
  "avatar5.png",
  "avatar6.png",
  "avatar7.png",
  "avatar8.png",
  "avatar9.png",
  "avatar10.png",
];

export default function Profile() {
  const [user, setUser] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [organizers, setOrganizers] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [edit, setEdit] = useState({
    firstName: "",
    lastName: "",
    contactNumber: "",
    collegeOrOrg: "",
    interests: [],
    followedOrganizers: [],

    organizerName: "",
    organizerCategory: "Technical",
    organizerDescription: "",
    organizerContactEmail: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/users/me")
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("user", JSON.stringify(res.data)); // ✅ sync
        setEdit({
          firstName: res.data.firstName || "",
          lastName: res.data.lastName || "",
          contactNumber: res.data.contactNumber || "",
          collegeOrOrg: res.data.collegeOrOrg || "",
          interests: res.data.interests || [],
          followedOrganizers: res.data.followedOrganizers || [],

          organizerName: res.data.organizerName || res.data.firstName || "",
          organizerCategory: res.data.organizerCategory || "Technical",
          organizerDescription: res.data.organizerDescription || "",
          organizerContactEmail: res.data.organizerContactEmail || "",
        });

        if (res.data.role === "participant") {
          api
            .get("/users/organizers")
            .then((orgRes) => setOrganizers(orgRes.data))
            .catch(() => setOrganizers([]));
        }
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  const handleLogout = () => {
    removeToken();
    localStorage.removeItem("user");
    navigate("/login");
  };

  const saveAvatar = async () => {
    if (!selectedAvatar) return;

    const res = await api.put("/users/avatar", {
      avatar: selectedAvatar,
    });

    setUser(res.data); // ✅ update UI
    localStorage.setItem("user", JSON.stringify(res.data)); // 🔥 CRITICAL
    window.dispatchEvent(new Event("user-updated"));
    setSelectedAvatar(null);
  };

  const toggleInterest = (interest) => {
    setEdit((prev) => {
      const current = prev.interests || [];
      const exists = current.includes(interest);
      return {
        ...prev,
        interests: exists ? current.filter((i) => i !== interest) : [...current, interest],
      };
    });
  };

  const toggleFollowedOrganizer = (organizerId) => {
    setEdit((prev) => {
      const ids = (prev.followedOrganizers || []).map(String);
      const id = String(organizerId);
      const exists = ids.includes(id);
      return {
        ...prev,
        followedOrganizers: exists
          ? ids.filter((x) => x !== id)
          : [...ids, id],
      };
    });
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    setProfileMessage("");

    try {
      let payload;

      if (user.role === "participant") {
        payload = {
          firstName: edit.firstName,
          lastName: edit.lastName,
          contactNumber: edit.contactNumber,
          collegeOrOrg: edit.collegeOrOrg,
          interests: edit.interests,
          followedOrganizers: edit.followedOrganizers,
        };
      } else if (user.role === "organizer") {
        payload = {
          organizerName: edit.organizerName,
          organizerCategory: edit.organizerCategory,
          organizerDescription: edit.organizerDescription,
          organizerContactEmail: edit.organizerContactEmail,
          contactNumber: edit.contactNumber,
        };
      } else {
        payload = {};
      }

      const res = await api.put("/users/me", payload);
      setUser(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
      window.dispatchEvent(new Event("user-updated"));
      setProfileMessage("Profile updated");
    } catch (err) {
      setProfileMessage(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const openResetModal = () => {
    setResetOpen(true);
    setResetReason("");
    setSecurityMessage("");
    setSecurityError("");
  };

  const closeResetModal = () => {
    if (resetBusy) return;
    setResetOpen(false);
  };

  const submitResetRequest = async () => {
    if (resetBusy) return;
    setResetBusy(true);
    setSecurityMessage("");
    setSecurityError("");
    try {
      await api.post("/password-resets", { reason: resetReason });
      setSecurityMessage("Password reset request submitted");
      setResetOpen(false);
    } catch (err) {
      setSecurityError(err.response?.data?.message || "Failed to request reset");
    } finally {
      setResetBusy(false);
    }
  };

  const updatePassword = async () => {
    setSecurityMessage("");
    setSecurityError("");

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setSecurityError("Please fill in all password fields");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setSecurityError("Passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      await api.put("/users/me/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setSecurityMessage("Password updated");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setSecurityError(err.response?.data?.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return <p className="loading">Loading...</p>;

  const displayName =
    user.role === "organizer"
      ? user.organizerName || user.firstName || ""
      : `${user.firstName || ""} ${user.lastName || ""}`.trim();

  const getInitials = (name) => {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "ME";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const initials = getInitials(displayName);

  const joinedDate = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(user.createdAt));

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {user.avatar ? (
              <img src={`/avatars/${user.avatar}`} alt="avatar" />
            ) : (
              <div className="avatar-initials">{initials}</div>
            )}
          </div>

          <div className="profile-info">
            <h2>{displayName}</h2>
            <p className="email">{user.email}</p>
            <p className="role">Role: {user.role}</p>
            {user.role === "participant" && (
              <p className="role">Participant Type: {user.participantType || "-"}</p>
            )}

            <div className="stats">
              <div>
                <b>Joined</b>
                <span>{joinedDate}</span>
              </div>

              {user.role === "participant" && (
                <div>
                  <b>Registrations</b>
                  <span>{user.registrationCount}</span>
                </div>
              )}

              {user.role !== "participant" && (
                <div>
                  <b>Events Created</b>
                  <span>{user.eventCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="profile-body">
          <div className="profile-column">
            <h3>Edit Profile</h3>
            {profileMessage && <p>{profileMessage}</p>}

            {user.role === "participant" && (
              <div className="profile-form">
                <input
                  value={edit.firstName}
                  onChange={(e) => setEdit((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="First Name"
                />
                <input
                  value={edit.lastName}
                  onChange={(e) => setEdit((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Last Name"
                />
                <input
                  value={edit.contactNumber}
                  onChange={(e) => setEdit((p) => ({ ...p, contactNumber: e.target.value }))}
                  placeholder="Contact Number"
                />
                <input
                  value={edit.collegeOrOrg}
                  onChange={(e) => setEdit((p) => ({ ...p, collegeOrOrg: e.target.value }))}
                  placeholder="College / Organization"
                />

                <div className="profile-block">
                  <b>Interests</b>
                  <div className="checkbox-grid">
                    {[
                      "Technical",
                      "Sports",
                      "Cultural",
                      "Other",
                    ].map((i) => (
                      <label key={i} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={(edit.interests || []).includes(i)}
                          onChange={() => toggleInterest(i)}
                        />
                        {i}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="profile-block">
                  <b>Followed Clubs</b>
                  <div className="checkbox-list followed-grid">
                    {organizers.map((o) => {
                      const name =
                        o.organizerName || `${o.firstName || ""} ${o.lastName || ""}`.trim();
                      const id = String(o._id);
                      return (
                        <label key={id} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={(edit.followedOrganizers || []).map(String).includes(id)}
                            onChange={() => toggleFollowedOrganizer(id)}
                          />
                          {name || "Organizer"}
                        </label>
                      );
                    })}
                    {organizers.length === 0 && <span>No organizers available.</span>}
                  </div>
                </div>

                <button onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            )}

            {user.role === "organizer" && (
              <div className="profile-form">
                <input
                  value={edit.organizerName}
                  onChange={(e) => setEdit((p) => ({ ...p, organizerName: e.target.value }))}
                  placeholder="Organizer Name"
                />
                <select
                  value={edit.organizerCategory}
                  onChange={(e) => setEdit((p) => ({ ...p, organizerCategory: e.target.value }))}
                >
                  <option value="Technical">Technical</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Sports">Sports</option>
                  <option value="Other">Other</option>
                </select>
                <textarea
                  value={edit.organizerDescription}
                  onChange={(e) => setEdit((p) => ({ ...p, organizerDescription: e.target.value }))}
                  placeholder="Description"
                  rows={3}
                />
                <input
                  value={edit.organizerContactEmail}
                  onChange={(e) => setEdit((p) => ({ ...p, organizerContactEmail: e.target.value }))}
                  placeholder="Contact Email (public)"
                />
                <input
                  value={edit.contactNumber}
                  onChange={(e) => setEdit((p) => ({ ...p, contactNumber: e.target.value }))}
                  placeholder="Contact Number"
                />
                <button onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            )}
          </div>

          <div className="profile-column">
            <h3>Select Avatar</h3>
            <div className="avatar-grid">
              {avatars.map((a) => (
                <img
                  key={a}
                  src={`/avatars/${a}`}
                  alt={a}
                  className={selectedAvatar === a ? "selected" : ""}
                  onClick={() => setSelectedAvatar(a)}
                />
              ))}
            </div>

            <button
              className="save-avatar-btn"
              disabled={!selectedAvatar}
              onClick={saveAvatar}
            >
              Save Avatar
            </button>

            {user.role === "participant" && (
              <div className="security-block">
                <h3>Security</h3>
                {securityMessage && <p className="security-success">{securityMessage}</p>}
                {securityError && <p className="security-error">{securityError}</p>}
                <div className="security-form">
                  <input
                    type="password"
                    placeholder="Current password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                    }
                  />
                  <input
                    type="password"
                    placeholder="New password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                    }
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                    }
                  />
                  <button type="button" onClick={updatePassword} disabled={changingPassword}>
                    {changingPassword ? "Updating..." : "Change Password"}
                  </button>
                </div>
              </div>
            )}

            {user.role === "organizer" && (
              <div className="security-block">
                <h3>Security</h3>
                {securityMessage && <p className="security-success">{securityMessage}</p>}
                {securityError && <p className="security-error">{securityError}</p>}
                <button type="button" onClick={openResetModal}>
                  Request Password Reset
                </button>
              </div>
            )}

            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {resetOpen && (
        <div className="reset-modal-backdrop" onClick={closeResetModal}>
          <div className="reset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reset-modal-header">
              <div>
                <h3>Request Password Reset</h3>
                <p>Tell the admin why you need a reset.</p>
              </div>
              <button type="button" onClick={closeResetModal}>
                Close
              </button>
            </div>
            <textarea
              rows={4}
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
              placeholder="Reason (optional)"
            />
            <div className="reset-modal-actions">
              <button type="button" onClick={closeResetModal}>
                Cancel
              </button>
              <button type="button" onClick={submitResetRequest} disabled={resetBusy}>
                {resetBusy ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
