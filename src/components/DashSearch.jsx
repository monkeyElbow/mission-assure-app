export default function DashSearch({ value = "", onChange }) {
    return (
      <div className="mb-3">
        <label htmlFor="dash-search" className="form-label small mb-1">Search</label>
        <input
          id="dash-search"
          type="text"
          className="form-control"
          placeholder="Type to filter…"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          aria-label="Live search"
        />
      </div>
    );
  }
  