import React, { useState, useMemo } from 'react'

function formatDate(d){
  if (!d) return ''
  try { return new Date(d).toLocaleString() } catch { return d }
}

export default function ClaimDetail({
  claim,
  statusOptions = [],
  onStatusChange,
  onSendMessage,
  onAddNote,
  showStatus = true,
  onClose,
  closeLabel = 'Close'
}){
  const [msgDraft, setMsgDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')

  const messages = useMemo(() => claim?.messages || [], [claim])
  const notes = useMemo(() => claim?.notes || [], [claim])

  if (!claim) return null

  const handleSend = () => {
    const text = msgDraft.trim()
    if (!text) return
    onSendMessage?.(claim.id, text)
    setMsgDraft('')
  }

  const handleAddNote = () => {
    const text = noteDraft.trim()
    if (!text) return
    onAddNote?.(claim.id, text)
    setNoteDraft('')
  }

  return (
    <div className="border rounded-3 p-3 bg-white">
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <div className="fw-semibold">{claim.claimNumber}</div>
          <div className="text-muted small">{claim.memberName || 'Traveler'} ({claim.memberEmail || '—'})</div>
          <div className="text-muted small">Reporter: {claim.reporterName || '—'} ({claim.reporterEmail || '—'})</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          {showStatus && (
            <>
              <div className="fw-semibold small mb-0">Status</div>
              <select
                className="form-select form-select-sm"
                value={claim.status}
                onChange={e => onStatusChange?.(claim.id, e.target.value)}
              >
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s.replace('_',' ')}</option>
                ))}
              </select>
            </>
          )}
          {onClose && (
            <button className="btn btn-link btn-sm" onClick={onClose}>{closeLabel}</button>
          )}
        </div>
      </div>
      <div className="mt-2 small text-muted">
        {claim.incidentType || 'Incident'} {claim.incidentLocation ? `· ${claim.incidentLocation}` : ''} {claim.incidentDate ? `· ${new Date(claim.incidentDate).toLocaleDateString()}` : ''}
      </div>
      <div className="mt-1">{claim.incidentDescription || 'No description provided.'}</div>
      {(claim.attachments || []).length > 0 && (
        <div className="mt-2 small">
          <strong>Attachments:</strong> {(claim.attachments || []).map(a => a.filename).join(', ')}
        </div>
      )}

      <div className="mt-3">
        <div className="fw-semibold small mb-1">Messages <span className="badge text-bg-light ms-1">Leader can see</span></div>
        {messages.length === 0 ? (
          <div className="text-muted small">No messages yet.</div>
        ) : (
          <ul className="list-unstyled mb-2 small">
            {messages.map(m => {
              const isAdmin = (m.authorRole || '').toUpperCase() === 'ADMIN';
              const bubbleStyle = isAdmin
                ? { background:'#f1f5f9', border:'1px solid #d0d7de' }
                : { background:'#fff', border:'1px solid #e9ecef' };
              return (
                <li key={m.id} className="border rounded-3 p-2 mb-2" style={bubbleStyle}>
                  <div className="fw-semibold">{m.authorName || m.authorRole || 'User'}</div>
                  <div>{m.text}</div>
                  <div className="text-muted">{m.createdAt ? formatDate(m.createdAt) : ''}</div>
                </li>
              );
            })}
          </ul>
        )}
        {onSendMessage && (
          <div className="d-flex gap-2">
            <input
              className="form-control form-control-sm"
              placeholder="Message leader…"
              value={msgDraft}
              onChange={e=>setMsgDraft(e.target.value)}
            />
            <button className="btn btn-outline-primary btn-sm" onClick={handleSend}>Send</button>
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="fw-semibold small mb-1">Notes <span className="badge text-bg-warning text-dark ms-1">Admin-only</span></div>
        {notes.length === 0 ? (
          <div className="text-muted small">No notes yet.</div>
        ) : (
          <ul className="list-unstyled mb-2 small">
            {notes.map(n => (
              <li key={n.id} className="border rounded-3 p-2 mb-2">
                <div className="fw-semibold">{n.author || 'Admin'}</div>
                <div>{n.text}</div>
                <div className="text-muted">{n.createdAt ? formatDate(n.createdAt) : ''}</div>
              </li>
            ))}
          </ul>
        )}
        {onAddNote && (
          <div className="d-flex gap-2">
            <input
              className="form-control form-control-sm"
              placeholder="Add note…"
              value={noteDraft}
              onChange={e=>setNoteDraft(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAddNote}>Add</button>
          </div>
        )}
      </div>
    </div>
  )
}
