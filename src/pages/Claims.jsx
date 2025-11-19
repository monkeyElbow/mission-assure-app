// src/pages/Claims.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../data/api'
import { listClaims, updateClaim, addClaimAttachment, markClaimSeen, addClaimMessage } from '../core/claims'
import ClaimQuickModal from '../components/trip/ClaimQuickModal.jsx'
import InlineNotice from '../components/InlineNotice.jsx'

export function removeClaimsForTrip(tripId){
  const KEY = 'missionassure.v1.claims';
  const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
  const kept = rows.filter(c => c.tripId !== tripId);
  localStorage.setItem(KEY, JSON.stringify(kept));
}


export default function Claims(){
  const loc = useLocation()
  const [claims, setClaims] = useState([])
  const [trips, setTrips] = useState([])
  const [filter, setFilter] = useState('ALL') // ALL or a status
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [activeClaim, setActiveClaim] = useState(null)
  const [messageDraft, setMessageDraft] = useState('')

  // claim flow state
  const [showTripPicker, setShowTripPicker] = useState(false)
  const [selectedTripId, setSelectedTripId] = useState('')
  const [selectedTripTitle, setSelectedTripTitle] = useState('')
  const [activeTrip, setActiveTrip] = useState(null)
  const [claimMembers, setClaimMembers] = useState([])
  const [quickModalOpen, setQuickModalOpen] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [activity, setActivity] = useState([])
  const [showActivity, setShowActivity] = useState(false)

  // initial load
  useEffect(()=>{
    (async()=>{
      const ts = await api.listTrips()
      setTrips(ts)
      setClaims(listClaims())
    })()
  },[])

  // auto-open wizard when navigated from Trip Detail
  useEffect(()=>{
    if (!trips.length) return
    const tId = loc.state?.tripId
    if (tId) {
      const t = trips.find(x => x.id === tId)
      const title = t?.title || loc.state?.tripTitle || ''
      setSelectedTripId(tId)
      setSelectedTripTitle(title)
      openQuickClaim(tId, title)
    }
  }, [loc.state, trips])

// keep active claim fresh when claims list changes (avoid loops)
  useEffect(()=>{
    if (!activeClaim) return;
    const fresh = listClaims().find(c => c.id === activeClaim.id);
    if (!fresh) return;
    const same = JSON.stringify(fresh) === JSON.stringify(activeClaim);
    if (!same) {
      setActiveClaim(fresh);
      setShowActivity(false);
    }
  }, [claims]);

  // load claim activity from trip history for the active claim
  useEffect(()=>{
    (async()=>{
      if (!activeClaim?.tripId) { setActivity([]); return; }
      try {
        const history = await api.getTripHistory(activeClaim.tripId);
        const rows = (history?.events || [])
          .filter(evt => {
            const matchesClaim = evt.claim_number === activeClaim.claimNumber || (evt.notes || '').includes(activeClaim.claimNumber);
            const isNoteEvent = String(evt.type || '').toUpperCase().includes('NOTE');
            return matchesClaim && !isNoteEvent; // hide admin/notes events from leader view
          })
          .map(evt => ({
            id: evt.event_id || `${evt.type}-${evt.timestamp}`,
            type: evt.type,
            notes: evt.notes,
            at: evt.timestamp
          }))
          .sort((a,b)=> new Date(b.at||0) - new Date(a.at||0));
        setActivity(rows);
      } catch (e){
        console.warn('Unable to load claim activity', e);
        setActivity([]);
      }
    })();
  }, [activeClaim]);

  const filtered = useMemo(() => {
    const base = filter === 'ALL' ? claims : claims.filter(c => c.status === filter)
    if (!q.trim()) return base
    const term = q.trim().toLowerCase()
    return base.filter(c => {
      const hay = [
        c.claimNumber,
        c.tripTitle,
        c.tripId,
        c.memberName,
        c.memberEmail,
        c.reporterName,
        c.incidentType,
        c.incidentLocation,
        c.status
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(term)
    })
  }, [claims, filter, q])

  function resetClaimFlow(){
    setSelectedTripId('')
    setSelectedTripTitle('')
    setShowTripPicker(false)
    setActiveTrip(null)
    setClaimMembers([])
    setQuickModalOpen(false)
    setLoadingMembers(false)
    setShowActivity(false)
  }

  async function openQuickClaim(tripId, tripTitle = '') {
    if (!tripId) return
    setErr('')
    setShowActivity(false)
    setLoadingMembers(true)
    try {
      const trip = trips.find(t => t.id === tripId) || (await api.getTrip(tripId))?.trip || {}
      const summary = await api.getRosterSummary(tripId)
      const ready = (summary.ready_roster || []).map(m => ({ ...m, id: m.member_id ?? m.id }))
      if (ready.length === 0) {
        setErr('No covered travelers found for that trip yet. Confirm coverage before filing a claim.')
        return
      }
      const resolvedTitle = trip.title || tripTitle || summary.trip_title || 'Trip'
      setSelectedTripTitle(resolvedTitle)
      setActiveTrip({
        id: trip.id || tripId,
        title: resolvedTitle,
        region: trip.region || summary.region || ''
      })
      setClaimMembers(ready)
      setQuickModalOpen(true)
      setShowTripPicker(false)
    } catch (ex) {
      console.error(ex)
      setErr(ex.message || 'Unable to load travelers for that trip.')
    } finally {
      setLoadingMembers(false)
    }
  }

  async function attachFile(id, file){
    try{
      await addClaimAttachment(id, file)
      setClaims(listClaims())
    }catch(ex){
      setErr(ex.message || 'Failed to attach file')
    }
  }

  return (
    <div className="container my-3" style={{maxWidth: 1100}}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 mb-0">Claims</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setErr('')
            setSuccess('')
            setSelectedTripId('')
            setSelectedTripTitle('')
            setShowTripPicker(true)
          }}
        >
          Report a Claim
        </button>
      </div>

      {err && (
        <InlineNotice tone="danger" dismissible timeoutMs={6000} className="mb-2">
          {err}
        </InlineNotice>
      )}
      {success && (
        <InlineNotice tone="success" dismissible timeoutMs={4000} className="mb-2">
          {success}
        </InlineNotice>
      )}

      {/* filters */}
      <div className="d-flex flex-column flex-md-row gap-2 mb-3 align-items-md-center">
        <div className="d-flex gap-2 flex-wrap">
          {['ALL','SUBMITTED','IN_REVIEW','MORE_INFO','APPROVED','DENIED','CLOSED'].map(s=>(
            <button key={s}
              className={`btn btn-sm ${filter===s?'btn-secondary':'btn-outline-secondary'}`}
              onClick={()=>setFilter(s)}>{s.replace('_',' ')}</button>
          ))}
        </div>
        <div className="ms-md-auto" style={{ minWidth: 240 }}>
          <input
            className="form-control form-control-sm"
            placeholder="Search claims…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* claims table */}
      <div className="card p-3 no-hover">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0 claims-table">
            <thead>
              <tr className="claims-head">
                <th scope="col">ID</th>
                <th scope="col">Trip</th>
                <th scope="col">Member</th>
                <th scope="col">Incident</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c=>{
                const isActive = activeClaim?.id === c.id;
                return (
                <React.Fragment key={c.id}>
                  <tr
                    className={c.freshForLeader ? 'table-warning' : ''}
                    onClick={async ()=>{
                      // toggle detail visibility; clear new flag when opening
                      if (isActive) { setActiveClaim(null); return; }
                      setActiveClaim(c);
                      setShowActivity(false);
                      try {
                        await markClaimSeen(c.id, 'LEADER');
                        const fresh = listClaims().find(x => x.id === c.id) || c;
                        setClaims(listClaims());
                        setActiveClaim(fresh);
                      } catch (e) {
                        console.warn('Unable to mark claim seen', e);
                      }
                    }}
                    style={{ cursor:'pointer' }}
                  >
                    <td className="claims-id text-muted small">
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        <span>{c.claimNumber}</span>
                        {c.freshForLeader && <span className="badge bg-danger">New</span>}
                      </div>
                    </td>
                    <td><span className="fw-semibold">{c.tripTitle || c.tripId}</span></td>
                    <td>
                      <div className="fw-medium">{c.memberName}</div>
                    </td>
                    <td>
                      <div className="small">{c.incidentType} — {c.incidentDate}</div>
                      <div className="text-muted small">{c.incidentLocation}</div>
                    </td>
                    <td>
                      <span className="badge text-bg-light text-uppercase">
                        {c.status?.replace('_',' ') || 'SUBMITTED'}
                      </span>
                    </td>
                  </tr>
                  {isActive && (
                    <tr>
                      <td colSpan={6}>
                        <div className="card mt-2 no-hover">
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <div>
                                <div className="fw-semibold">{c.claimNumber}</div>
                                <div className="text-muted small">{c.tripTitle || c.tripId}</div>
                                <div className="text-muted small">{c.memberName || 'Traveler'} ({c.memberEmail || '—'})</div>
                                {c.memberPhone && <div className="text-muted small">{c.memberPhone}</div>}
                              </div>
                              <button className="btn btn-sm btn-outline-secondary" onClick={()=>setActiveClaim(null)}>Close</button>
                            </div>
                            <div className="small text-muted">
                              {c.incidentType || 'Incident'} {c.incidentLocation ? `· ${c.incidentLocation}` : ''} {c.incidentDate ? `· ${new Date(c.incidentDate).toLocaleDateString()}` : ''}
                            </div>
                            <div className="mt-2">{c.incidentDescription || c.description || 'No description provided.'}</div>
                            {(c.attachments || []).length > 0 && (
                              <div className="mt-2 small">
                                <strong>Attachments:</strong> {(c.attachments || []).map(a => a.filename).join(', ')}
                              </div>
                            )}
                            <div className="mt-2">
                              <label className="btn btn-outline-secondary btn-sm mb-1">
                                Upload file…
                                <input type="file" hidden onChange={e=>e.target.files?.[0] && attachFile(c.id, e.target.files[0])}/>
                              </label>
                              <span className="text-muted small ms-2">{(c.attachments||[]).length} file(s)</span>
                            </div>

                            <div className="mt-3">
                            <div className="fw-semibold small mb-1">Messages</div>
                            {(c.messages || []).length === 0 ? (
                              <div className="text-muted small">No messages yet.</div>
                            ) : (
                              <ul className="list-unstyled mb-2 small">
                                {c.messages.map(m => (
                                    <li key={m.id} className="border rounded-3 p-2 mb-2">
                                      <div className="fw-semibold">{m.authorName || m.authorRole || 'User'}</div>
                                      <div>{m.text}</div>
                                      <div className="text-muted">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <div className="d-flex gap-2">
                                <input
                                  className="form-control form-control-sm"
                                  placeholder="Message admin…"
                                  value={messageDraft}
                                  onChange={e=>setMessageDraft(e.target.value)}
                                />
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={async ()=>{
                                    const text = messageDraft.trim();
                                    if (!text) return;
                                    await addClaimMessage(c.id, { authorRole:'LEADER', authorName: c.reporterName || 'Leader', text });
                                    setClaims(listClaims());
                                    const fresh = listClaims().find(x => x.id === c.id);
                                    setActiveClaim(fresh || null);
                                    setMessageDraft('');
                                  }}
                                >
                                  Send
                                </button>
                              </div>
                            </div>

                            {activity.length > 0 && (
                              <div className="mt-3">
                                <div className="fw-semibold small mb-1 d-flex align-items-center gap-2">
                                  <span>Activity</span>
                                  {!showActivity ? (
                                    <button className="btn btn-link btn-sm p-0" onClick={()=>setShowActivity(true)}>
                                      See all activity
                                    </button>
                                  ) : (
                                    <button className="btn btn-link btn-sm p-0" onClick={()=>setShowActivity(false)}>
                                      Hide activity
                                    </button>
                                  )}
                                </div>
                                {showActivity && (
                                  <ul className="list-unstyled mb-0 small" style={{ maxHeight: 240, overflowY: 'auto' }}>
                                    {activity.map(a => (
                                      <li key={a.id} className="border rounded-3 p-2 mb-2">
                                        <div className="fw-semibold">{a.type}</div>
                                        <div>{a.notes}</div>
                                        <div className="text-muted">{a.at ? new Date(a.at).toLocaleString() : ''}</div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )})}
              {filtered.length===0 && (
                <tr><td colSpan="5" className="text-muted text-center py-4">No claims</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showTripPicker && (
        <div className="position-fixed top-0 start-0 w-100 h-100" style={{ background: 'rgba(0,0,0,.35)' }}>
          <div className="d-flex align-items-center justify-content-center h-100">
            <div className="card no-hover" style={{ width: 520 }}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h2 className="h5 mb-0">Choose a Trip</h2>
                  <button className="btn btn-sm btn-outline-secondary" onClick={resetClaimFlow}>Close</button>
                </div>
                <label className="form-label">Trip</label>
                <select
                  className="form-select"
                  value={selectedTripId}
                  onChange={e => {
                    const value = e.target.value
                    setSelectedTripId(value)
                    const trip = trips.find(tt => tt.id === value)
                    setSelectedTripTitle(trip?.title || '')
                  }}
                >
                  <option value="">Select a trip…</option>
                  {trips.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.startDate} → {t.endDate})
                    </option>
                  ))}
                </select>
                <div className="d-flex justify-content-end gap-2 mt-3">
                  <button className="btn btn-outline-secondary" onClick={resetClaimFlow}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    disabled={!selectedTripId || loadingMembers}
                    onClick={() => openQuickClaim(selectedTripId, selectedTripTitle)}
                  >
                    {loadingMembers ? 'Loading…' : 'Continue'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTrip && (
        <ClaimQuickModal
          open={quickModalOpen}
          onClose={() => {
            resetClaimFlow()
          }}
          onSubmitted={(row) => {
            setSuccess(`Claim ${row.claimNumber} submitted.`)
            setClaims(listClaims())
            resetClaimFlow()
          }}
          trip={activeTrip}
          members={claimMembers}
        />
      )}
    </div>
  )
}
