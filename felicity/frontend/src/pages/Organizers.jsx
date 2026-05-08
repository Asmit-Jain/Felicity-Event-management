import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./Organizers.css";

export default function Organizers() {
  const [organizers, setOrganizers] = useState([]);
  const [me, setMe] = useState(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const followedSet = useMemo(() => {
    const ids = me?.followedOrganizers || [];
    return new Set(ids.map((id) => String(id)));
  }, [me]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const [meRes, orgRes] = await Promise.all([
          api.get("/users/me"),
          api.get("/users/organizers"),
        ]);
        if (!active) return;
        setMe(meRes.data);
        localStorage.setItem("user", JSON.stringify(meRes.data));
        window.dispatchEvent(new Event("user-updated"));
        setOrganizers(orgRes.data);
        setMessage("");
      } catch {
        if (!active) return;
        setMessage("Failed to load organizers");
      }
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  const follow = async (id) => {
    setMessage("");
    try {
      const res = await api.put(`/users/follow/${id}`);
      setMe(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
      window.dispatchEvent(new Event("user-updated"));
    } catch (e) {
      setMessage(e.response?.data?.message || "Failed to follow");
    }
  };

  const unfollow = async (id) => {
    setMessage("");
    try {
      const res = await api.put(`/users/unfollow/${id}`);
      setMe(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
      window.dispatchEvent(new Event("user-updated"));
    } catch (e) {
      setMessage(e.response?.data?.message || "Failed to unfollow");
    }
  };

  return (
    <div className="organizers-page">
      <h2>Clubs / Organizers</h2>
      {message && <p>{message}</p>}

      <div className="organizers-grid">
        {organizers.map((o) => {
          const id = String(o._id);
          const name = o.organizerName || `${o.firstName || ""} ${o.lastName || ""}`.trim();
          const isFollowed = followedSet.has(id);
          return (
            <div key={o._id} className="organizer-card">
              <h3 className="organizer-title">{name || "Organizer"}</h3>
              <p className="organizer-meta">Category: {o.organizerCategory || "-"}</p>
              <p className="organizer-meta">Contact: {o.organizerContactEmail || "-"}</p>
              <p className="organizer-desc">{o.organizerDescription || "No description"}</p>

              <div className="organizer-actions">
                <button className="secondary" onClick={() => navigate(`/organizers/${o._id}`)}>
                  View
                </button>
                {isFollowed ? (
                  <button onClick={() => unfollow(o._id)}>Unfollow</button>
                ) : (
                  <button onClick={() => follow(o._id)}>Follow</button>
                )}
              </div>
            </div>
          );
        })}

        {organizers.length === 0 && <p>No organizers found.</p>}
      </div>
    </div>
  );
}
