import { useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { saveToken } from "../utils/auth";
import "./Login.css"; // reuse same styles

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    participantType: "IIIT",
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/auth/register", form);

      // Auto-login so onboarding can be protected (PDF: only login/signup public)
      const loginRes = await api.post("/auth/login", {
        email: form.email?.trim(),
        password: form.password?.trim(),
      });
      saveToken(loginRes.data.token);

      navigate("/onboarding", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="page">
      <h2 className="title">Create Account</h2>
      <p className="subtitle">Join Felicity</p>

      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <input name="firstName" placeholder="First Name" onChange={handleChange} required />
        <input name="lastName" placeholder="Last Name" onChange={handleChange} required />
        <input name="email" type="email" placeholder="Email" onChange={handleChange} required />
        <input name="password" type="password" placeholder="Password" onChange={handleChange} required />

        <select
          name="participantType"
          value={form.participantType}
          onChange={handleChange}
          required
        >
          <option value="IIIT">IIIT Participant</option>
          <option value="Non-IIIT">Non-IIIT Participant</option>
        </select>

        <button type="submit">Register</button>
      </form>
    </div>
  );
}
