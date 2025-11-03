// MinorFields.jsx
import React from "react";
import { useAutoHeight } from "./useAutoHeight";

export default function MinorFields({ open, values, onChange }) {
  const ref = useAutoHeight(open);

  return (
    <div
      ref={ref}
      className={`minor-wrap ${open ? "is-open" : ""}`}
      aria-hidden={!open}
    >
      <div className="row g-2 py-2">
        <div className="col-md-6 minor-field" style={{ "--d": "40ms" }}>
          <label className="form-label">Guardian First Name</label>
          <input
            className="form-control"
            type="text"
            value={values.guardianFirstName || ""}
            onChange={(e) =>
              onChange({ guardianFirstName: e.target.value })
            }
          />
        </div>

        <div className="col-md-6 minor-field" style={{ "--d": "80ms" }}>
          <label className="form-label">Guardian Last Name</label>
          <input
            className="form-control"
            type="text"
            value={values.guardianLastName || ""}
            onChange={(e) =>
              onChange({ guardianLastName: e.target.value })
            }
          />
        </div>

        <div className="col-md-6 minor-field" style={{ "--d": "120ms" }}>
          <label className="form-label">Guardian Email</label>
          <input
            className="form-control"
            type="email"
            value={values.guardianEmail || ""}
            onChange={(e) => onChange({ guardianEmail: e.target.value })}
          />
        </div>

        <div className="col-md-6 minor-field" style={{ "--d": "160ms" }}>
          <label className="form-label">Guardian Phone</label>
          <input
            className="form-control"
            type="tel"
            value={values.guardianPhone || ""}
            onChange={(e) => onChange({ guardianPhone: e.target.value })}
          />
        </div>

        {/* <div className="col-12 minor-field" style={{ "--d": "200ms" }}>
          <label className="form-label">Relationship to Minor</label>
          <input
            className="form-control"
            type="text"
            placeholder="Parent, Legal Guardian, etc."
            value={values.guardianRelation || ""}
            onChange={(e) => onChange({ guardianRelation: e.target.value })}
          />
        </div> */}

        {/* <div className="col-12 minor-field" style={{ "--d": "240ms" }}>
          <div className="form-check">
            <input
              id="guardianConsent"
              className="form-check-input"
              type="checkbox"
              checked={!!values.guardianConsent}
              onChange={(e) => onChange({ guardianConsent: e.target.checked })}
            />
            <label className="form-check-label" htmlFor="guardianConsent">
              I certify I am the parent/legal guardian and consent to this traveler’s participation.
            </label>
          </div>
        </div> */}
      </div>
    </div>
  );
}
