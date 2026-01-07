import React from 'react'

export default function AdminLeaderDrawer({ leader, open, onClose }){
  if(!open) return null
  const name = [leader?.firstName, leader?.lastName].filter(Boolean).join(' ').trim() || leader?.name || '—';
  const churchLines = [
    leader?.churchAddress1,
    leader?.churchAddress2
  ].filter(Boolean);
  const cityState = [leader?.churchCity, leader?.churchState, leader?.churchPostal].filter(Boolean).join(', ');
  const country = leader?.churchCountry;
  if (cityState) churchLines.push(cityState);
  if (country) churchLines.push(country);
  return (
    <div className="ma-modal-backdrop" onClick={onClose}>
      <div className="ma-modal" onClick={e=>e.stopPropagation()}>
        <div className="ma-modal-header d-flex justify-content-between align-items-center">
          <strong>Leader</strong>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>×</button>
        </div>
        <div className="ma-modal-body">
          <div><strong>{name}</strong></div>
          <div className="text-muted small">{leader?.title || '—'}</div>
          <div className="small">{leader?.email || '—'}</div>
          <div className="small">{leader?.phone || '—'}</div>
          <hr className="my-2" />
          <div className="fw-semibold">{leader?.churchName || '—'}</div>
          <div className="text-muted small">{leader?.legalName || '—'}</div>
          <div className="small">{leader?.churchPhone || leader?.phone || '—'}</div>
          <div className="small">{churchLines.length ? churchLines.join(' · ') : '—'}</div>
          <div className="small text-muted">EIN: {leader?.ein || '—'}</div>
        </div>
      </div>
      <style>{`
        .ma-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1050}
        .ma-modal{background:#fff;border-radius:12px;max-width:520px;width:92vw;box-shadow:0 20px 80px rgba(0,0,0,.25)}
        .ma-modal-header{padding:12px 16px;border-bottom:1px solid #eee}
        .ma-modal-body{padding:16px}
      `}</style>
    </div>
  )
}
