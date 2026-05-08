import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./CreateEvent.css";

export default function CreateEvent() {
  const navigate = useNavigate();

  const toUtcIsoFromLocalInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  };

  const [form, setForm] = useState({
    title: "",
    description: "",
    venue: "",
    totalPrizeMoney: "",
    category: "Technical",
    eventType: "normal",
    eligibility: "Both",
    registrationDeadline: "",
    registrationLimit: 1,
    startDate: "",
    endDate: "",
    registrationFee: "",
    eventTags: "",
  });

  const [registrationFormFields, setRegistrationFormFields] = useState([]);
  const [merchandiseItems, setMerchandiseItems] = useState([
    {
      name: "",
      itemPrice: "",
      variants: [{ size: "", color: "", stock: 0 }],
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const onChange = (key) => (e) => {
    const shouldKeepAsText = key === "registrationFee" || key === "totalPrizeMoney";
    const value =
      e.target.type === "number" && !shouldKeepAsText
        ? Number(e.target.value)
        : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const moveRegistrationField = (index, direction) => {
    setRegistrationFormFields((prev) => {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        eventType: form.eventType,
        participationType: "individual",
        eligibility: form.eligibility,
        eventTags: String(form.eventTags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        registrationFormFields: form.eventType === "normal" ? registrationFormFields : [],
        merchandiseItems: form.eventType === "merchandise" ? merchandiseItems : [],
        venue: form.eventType === "normal" ? String(form.venue || "").trim() || null : null,
        totalPrizeMoney: form.eventType === "normal" ? Number(form.totalPrizeMoney || 0) : 0,
        registrationDeadline: toUtcIsoFromLocalInput(form.registrationDeadline),
        registrationLimit: form.registrationLimit,
        startDate: toUtcIsoFromLocalInput(form.startDate),
        endDate: toUtcIsoFromLocalInput(form.endDate),
        registrationFee: form.eventType === "normal" ? Number(form.registrationFee || 0) : 0,
        status: "draft",
      };

      await api.post("/events", payload);
      setMessage("Event draft created successfully");
      navigate("/my-events");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to create event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="create-event-page">
      <div className="create-event-card">
        <div className="create-event-header">
          <h2>Create Event (Draft)</h2>
          <p>Fill all required event attributes, then save as draft.</p>
        </div>

        <form onSubmit={handleSubmit} className="create-event-form">
          <div className="ce-grid ce-grid-2">
            <label>
              Event Name
              <input value={form.title} onChange={onChange("title")} required />
            </label>
          </div>

          <label>
            Event Description
            <textarea value={form.description} onChange={onChange("description")} rows={4} required />
          </label>

          {form.eventType === "normal" && (
            <div className="ce-grid ce-grid-2">
              <label>
                Venue
                <input
                  value={form.venue}
                  onChange={onChange("venue")}
                  placeholder="eg. H105"
                />
              </label>

              <label>
                Total Prize Money (INR)
                <input
                  type="number"
                  min={0}
                  className="no-spinner"
                  value={form.totalPrizeMoney}
                  onChange={onChange("totalPrizeMoney")}
                  placeholder="Enter prize money"
                />
              </label>
            </div>
          )}

          <div className="ce-grid ce-grid-3">
            <label>
              Category
              <select value={form.category} onChange={onChange("category")} required>
                <option value="Technical">Technical</option>
                <option value="Cultural">Cultural</option>
                <option value="Sports">Sports</option>
                <option value="Other">Other</option>
                <option value="Merchandise">Merchandise</option>
              </select>
            </label>

            <label>
              Event Type
              <select value={form.eventType} onChange={onChange("eventType")} required>
                <option value="normal">Normal</option>
                <option value="merchandise">Merchandise</option>
              </select>
            </label>

            <label>
              Eligibility
              <select value={form.eligibility} onChange={onChange("eligibility")} required>
                <option value="Both">Both</option>
                <option value="IIIT">IIIT</option>
                <option value="Non-IIIT">Non-IIIT</option>
              </select>
            </label>
          </div>

          <label>
            Event Tags (comma-separated)
            <input
              value={form.eventTags}
              onChange={onChange("eventTags")}
              placeholder="coding, dance, hackathon"
            />
          </label>

          <div className="ce-grid ce-grid-2">
            <label>
              Registration Deadline
              <input
                type="datetime-local"
                value={form.registrationDeadline}
                onChange={onChange("registrationDeadline")}
                required
              />
            </label>

            <label>
              Registration Limit
              <input
                type="number"
                min={1}
                value={form.registrationLimit}
                onChange={onChange("registrationLimit")}
                required
              />
            </label>
          </div>

          <div className="ce-grid ce-grid-2">
            <label>
              Event Start Date
              <input type="datetime-local" value={form.startDate} onChange={onChange("startDate")} required />
            </label>

            <label>
              Event End Date
              <input type="datetime-local" value={form.endDate} onChange={onChange("endDate")} required />
            </label>
          </div>

          {form.eventType === "normal" && (
            <label>
              Registration Fee
              <input
                type="number"
                min={0}
                className="no-spinner"
                value={form.registrationFee}
                onChange={onChange("registrationFee")}
                placeholder="Enter registration fee"
              />
            </label>
          )}

          {form.eventType === "normal" && (
            <section className="ce-section">
              <h3>Custom Registration Form (Dynamic Builder)</h3>
              <p>Add, remove, and reorder fields for participant registration.</p>

              <div className="ce-stack">
                {registrationFormFields.map((field, idx) => (
                  <div key={idx} className="ce-subcard">
                    <div className="ce-grid ce-grid-2">
                      <label>
                        Key
                        <input
                          value={field.key}
                          onChange={(e) =>
                            setRegistrationFormFields((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x))
                            )
                          }
                          placeholder="eg. rollNumber"
                        />
                      </label>

                      <label>
                        Label
                        <input
                          value={field.label}
                          onChange={(e) =>
                            setRegistrationFormFields((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x))
                            )
                          }
                          placeholder="eg. Roll Number"
                        />
                      </label>
                    </div>

                    <div className="ce-grid ce-grid-2">
                      <label>
                        Type
                        <select
                          value={field.type}
                          onChange={(e) =>
                            setRegistrationFormFields((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, type: e.target.value } : x))
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

                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={!!field.required}
                          onChange={(e) =>
                            setRegistrationFormFields((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x))
                            )
                          }
                        />
                        Required
                      </label>
                    </div>

                    {field.type === "select" && (
                      <label>
                        Options (comma-separated)
                        <input
                          value={(field.options || []).join(", ")}
                          onChange={(e) =>
                            setRegistrationFormFields((prev) =>
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
                          placeholder="Option A, Option B"
                        />
                      </label>
                    )}

                    <div className="ce-actions-row">
                      <button type="button" onClick={() => moveRegistrationField(idx, "up")} disabled={idx === 0}>
                        Move Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRegistrationField(idx, "down")}
                        disabled={idx === registrationFormFields.length - 1}
                      >
                        Move Down
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() =>
                          setRegistrationFormFields((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        Remove Field
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setRegistrationFormFields((prev) => [
                      ...prev,
                      { key: "", label: "", type: "text", required: false, options: [] },
                    ])
                  }
                >
                  Add Field
                </button>
              </div>
            </section>
          )}

          {form.eventType === "merchandise" && (
            <section className="ce-section">
              <h3>Merchandise Events Details</h3>
              <p>Define item details, variants, and stock quantity.</p>

              <div className="ce-stack">
                {merchandiseItems.map((item, itemIdx) => (
                  <div key={itemIdx} className="ce-subcard">
                    <div className="ce-grid ce-grid-3">
                      <label>
                        Item Name
                        <input
                          value={item.name}
                          onChange={(e) =>
                            setMerchandiseItems((prev) =>
                              prev.map((x, i) => (i === itemIdx ? { ...x, name: e.target.value } : x))
                            )
                          }
                          placeholder="eg. T-Shirt"
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
                            setMerchandiseItems((prev) =>
                              prev.map((x, i) =>
                                i === itemIdx
                                  ? { ...x, itemPrice: e.target.value }
                                  : x
                              )
                            )
                          }
                          placeholder="eg. 500"
                        />
                      </label>
                    </div>

                    <div className="ce-variants-wrap">
                      <strong>Variants</strong>
                      {(item.variants || []).map((variant, variantIdx) => (
                        <div key={variantIdx} className="ce-grid ce-grid-4 ce-variant-row">
                          <label>
                            Size
                            <input
                              value={variant.size}
                              onChange={(e) =>
                                setMerchandiseItems((prev) =>
                                  prev.map((x, i) => {
                                    if (i !== itemIdx) return x;
                                    const variants = (x.variants || []).map((vv, j) =>
                                      j === variantIdx ? { ...vv, size: e.target.value } : vv
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
                                setMerchandiseItems((prev) =>
                                  prev.map((x, i) => {
                                    if (i !== itemIdx) return x;
                                    const variants = (x.variants || []).map((vv, j) =>
                                      j === variantIdx ? { ...vv, color: e.target.value } : vv
                                    );
                                    return { ...x, variants };
                                  })
                                )
                              }
                            />
                          </label>

                          <label>
                            Stock Quantity
                            <input
                              type="number"
                              min={0}
                              value={variant.stock}
                              onChange={(e) =>
                                setMerchandiseItems((prev) =>
                                  prev.map((x, i) => {
                                    if (i !== itemIdx) return x;
                                    const variants = (x.variants || []).map((vv, j) =>
                                      j === variantIdx ? { ...vv, stock: Number(e.target.value) } : vv
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
                              setMerchandiseItems((prev) =>
                                prev.map((x, i) => {
                                  if (i !== itemIdx) return x;
                                  return {
                                    ...x,
                                    variants: (x.variants || []).filter((_, j) => j !== variantIdx),
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
                        className="btn-secondary"
                        onClick={() =>
                          setMerchandiseItems((prev) =>
                            prev.map((x, i) => {
                              if (i !== itemIdx) return x;
                              return {
                                ...x,
                                variants: [...(x.variants || []), { size: "", color: "", stock: 0 }],
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
                      onClick={() => setMerchandiseItems((prev) => prev.filter((_, i) => i !== itemIdx))}
                    >
                      Remove Item
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setMerchandiseItems((prev) => [
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
            </section>
          )}

          <div className="ce-submit-row">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create Draft"}
            </button>
            {message && <p className="ce-message">{message}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}
