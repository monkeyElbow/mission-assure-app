import { useEffect, useState } from "react";

export default function DashboardFilters({ value = {}, onChange }) {
  const [q, setQ] = useState(value.q ?? "");
  const [status, setStatus] = useState(value.status ?? "active"); // 'active'|'archived'|'all'
  const [upcomingDays, setUpcomingDays] = useState(value.upcomingDays ?? "");
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");

  // debounce 150ms
  useEffect(() => {
    const id = setTimeout(() => onChange?.({ q, status, upcomingDays, from, to }), 150);
    return () => clearTimeout(id);
  }, [q, status, upcomingDays, from, to, onChange]);

  const clearAll = () => {
    setQ(""); setStatus("active"); setUpcomingDays(""); setFrom(""); setTo("");
    onChange?.({ q: "", status: "active", upcomingDays: "", from: "", to: "" });
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex-1">
        <label htmlFor="dash-search" className="block text-sm font-medium">Search</label>
        <input
          id="dash-search"
          type="text"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Type to filter…"
          className="w-full rounded-md border px-3 py-2"
          aria-label="Live search"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Status</label>
        <div className="inline-flex gap-2">
          {["active","archived","all"].map(s => (
            <button
              key={s}
              type="button"
              onClick={()=>setStatus(s)}
              className={`rounded-md border px-3 py-2 text-sm ${status===s ? "bg-black text-white" : ""}`}
              aria-pressed={status===s}
            >
              {s[0].toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Upcoming (days)</label>
        <div className="flex gap-2">
          <select
            value={upcomingDays}
            onChange={(e)=>setUpcomingDays(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="">Any time</option>
            <option value="7">Next 7</option>
            <option value="14">Next 14</option>
            <option value="30">Next 30</option>
            <option value="60">Next 60</option>
            <option value="90">Next 90</option>
          </select>
          <input
            type="number"
            min="1"
            placeholder="Custom"
            value={["7","14","30","60","90"].includes(String(upcomingDays)) ? "" : (upcomingDays || "")}
            onChange={(e)=>setUpcomingDays(e.target.value)}
            className="w-24 rounded-md border px-3 py-2"
            aria-label="Custom days"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div>
          <label className="block text-sm font-medium">From</label>
          <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="rounded-md border px-3 py-2"/>
        </div>
        <div>
          <label className="block text-sm font-medium">To</label>
          <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="rounded-md border px-3 py-2"/>
        </div>
      </div>

      <div>
        <button type="button" onClick={clearAll} className="rounded-md border px-3 py-2">Clear</button>
      </div>
    </div>
  );
}
