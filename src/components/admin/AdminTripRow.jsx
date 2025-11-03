import React from 'react'

function fmt(d){ try{ return new Date(d).toLocaleDateString() } catch{ return d } }

export default function AdminTripRow({ trip, onQuickEdit, onArchiveToggle, onSelectTrip }){
  const statusBadge = (s)=>{
    const map = { LIVE:'bg-agf2', PAUSED:'bg-secondary', ARCHIVED:'bg-dark', DRAFT:'bg-info' }
    return <span className={`badge ${map[s]||'bg-secondary'}`}>{s}</span>
  }
  const payBadge = (s)=>{
    const map = { PAID:'bg-agf2', PARTIAL:'bg-melon text-dark', UNPAID:'bg-danger' }
    return <span className={`badge ${map[s]||'bg-secondary'}`}>{s||'UNPAID'}</span>
  }
  return (
    <tr>
      <td>
        <div className="fw-semibold">{trip.title}</div>
        <div className="text-muted small">{trip.shortId || trip.id.slice(0,6)}</div>
      </td>
      <td className="text-muted small">{trip.leaderId||'—'}</td>
      <td className="text-muted small">{fmt(trip.startDate)} → {fmt(trip.endDate)}</td>
      <td>{statusBadge(trip.status)}</td>
      <td>{payBadge(trip.paymentStatus)}</td>
      <td className="text-end">
        <div className="btn-group btn-group-sm">
          <button className="btn btn-outline-secondary" onClick={()=> onSelectTrip?.(trip.id)}>Open</button>
          {trip.status!=='ARCHIVED' ? (
            <button className="btn btn-outline-dark" onClick={()=> onArchiveToggle?.(trip.id, true)}>Archive</button>
          ) : (
            <button className="btn btn-outline-dark" onClick={()=> onArchiveToggle?.(trip.id, false)}>Unarchive</button>
          )}
        </div>
      </td>
    </tr>
  )
}