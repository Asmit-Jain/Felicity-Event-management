import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Onboarding() {
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [organizers, setOrganizers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [interests, setInterests] = useState([]);
  const [followedOrganizers, setFollowedOrganizers] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await api.get("/users/me");
        setMe(meRes.data);

        setInterests(meRes.data.interests || []);
        setFollowedOrganizers((meRes.data.followedOrganizers || []).map(String));

        if (meRes.data.role === "participant") {
          try {
            const orgRes = await api.get("/users/organizers");
            setOrganizers(orgRes.data || []);
          } catch {
            setOrganizers([]);
          }
        }
      } catch {
        navigate("/login", { replace: true });
      }
    };

    load();
  }, [navigate]);

  useEffect(() => {
    if (me && me.role !== "participant") {
      navigate("/dashboard", { replace: true });
    }
  }, [me, navigate]);

  const toggleInterest = (interest) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((x) => x !== interest) : [...prev, interest]
    );
  };

  const toggleFollowed = (id) => {
    const organizerId = String(id);
    setFollowedOrganizers((prev) =>
      prev.includes(organizerId)
        ? prev.filter((x) => x !== organizerId)
        : [...prev, organizerId]
    );
  };

  const save = async () => {
    setSaving(true);
    setMessage("");

    try {
      const res = await api.put("/users/me", {
        interests,
        followedOrganizers,
      });

      localStorage.setItem("user", JSON.stringify(res.data));
      window.dispatchEvent(new Event("user-updated"));

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    navigate("/dashboard", { replace: true });
  };

  if (!me) return <div style={{ padding: 40 }}>Loading...</div>;

  if (me.role !== "participant") return null;

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Set your preferences</h2>
      <p style={{ opacity: 0.8 }}>
        You can skip now and update later from Profile.
      </p>

      {message && <p>{message}</p>}

      <div style={{ display: "grid", gap: 20, marginTop: 20 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Areas of Interest</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {["Technical", "Cultural", "Sports", "Other"].map((i) => (
              <label key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={interests.includes(i)}
                  onChange={() => toggleInterest(i)}
                />
                {i}
              </label>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Clubs / Organizers to Follow</h3>
          <div style={{ display: "grid", gap: 8, maxHeight: 240, overflow: "auto" }}>
            {organizers.map((o) => {
              const id = String(o._id);
              const name = o.organizerName || `${o.firstName || ""} ${o.lastName || ""}`.trim();
              return (
                <label key={id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={followedOrganizers.includes(id)}
                    onChange={() => toggleFollowed(id)}
                  />
                  {name || "Organizer"}
                </label>
              );
            })}
            {organizers.length === 0 && <span>No organizers available.</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save & Continue"}
          </button>
          <button type="button" onClick={skip} disabled={saving}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
