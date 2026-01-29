// src/pages/Claims.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../data/api'
import { listClaims, addClaimAttachment, markClaimSeen, addClaimMessage, addClaimNote, updateClaim } from '../core/claims'
import ClaimQuickModal from '../components/trip/ClaimQuickModal.jsx'
import InlineNotice from '../components/InlineNotice.jsx'
import ClaimDetail from '../components/claims/ClaimDetail.jsx'


export default function Claims(){
  const loc = useLocation()
  const [claims, setClaims] = useState([])
  const [trips, setTrips] = useState([])
  const [filter, setFilter] = useState('ALL') // ALL or a status
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [activeClaim, setActiveClaim] = useState(null)

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

  const openQuickClaim = useCallback(async (tripId, tripTitle = '') => {
    if (!tripId) return;
    setErr('');
    setShowActivity(false);
    setLoadingMembers(true);
    try {
      const trip = trips.find(t => t.id === tripId) || (await api.getTrip(tripId))?.trip || {};
      const summary = await api.getRosterSummary(tripId);
      const ready = (summary.ready_roster || []).map(m => ({ ...m, id: m.member_id ?? m.id }));
      if (ready.length === 0) {
        setErr('No covered travelers found for that trip yet. Confirm coverage before filing a claim.');
        return;
      }
      const resolvedTitle = trip.title || tripTitle || summary.trip_title || 'Trip';
      setSelectedTripTitle(resolvedTitle);
      setActiveTrip({
        id: trip.id || tripId,
        title: resolvedTitle,
        region: trip.region || summary.region || '',
      });
      setClaimMembers(ready);
      setQuickModalOpen(true);
      setShowTripPicker(false);
    } catch (ex) {
      console.error(ex);
      setErr(ex.message || 'Unable to load travelers for that trip.');
    } finally {
      setLoadingMembers(false);
    }
  }, [trips]);

  // initial load
  useEffect(()=>{
    (async()=>{
      const ts = await api.listTrips()
      setTrips(ts)
      setClaims(listClaims())
    })()
  },[])

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
  }, [activeClaim, claims]);

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
        c.memberFirstName,
        c.memberLastName,
        c.memberEmail,
        c.memberPhone,
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

  // auto-open wizard when navigated from Trip Detail
  useEffect(()=>{
    if (!trips.length) return;
    const tId = loc.state?.tripId;
    if (tId) {
      const t = trips.find(x => x.id === tId);
      const title = t?.title || loc.state?.tripTitle || '';
      setSelectedTripId(tId);
      setSelectedTripTitle(title);
      openQuickClaim(tId, title);
    }
  }, [loc.state, openQuickClaim, trips]);

  async function attachFile(id, file){
    try{
      await addClaimAttachment(id, file)
      setClaims(listClaims())
    }catch(ex){
      setErr(ex.message || 'Failed to attach file')
    }
  }

  async function updateStatus(id, status){
    try{
      const saved = await updateClaim(id, { status });
      setClaims(listClaims());
      if (activeClaim?.id === id) setActiveClaim(saved);
      setSuccess(`Updated claim to ${status.replace('_',' ')}`);
      setTimeout(()=>setSuccess(''), 1500);
    }catch(e){
      setErr(e?.message || 'Unable to update status.');
      setTimeout(()=>setErr(''), 2500);
    }
  }

  async function sendMessage(id, text){
    const body = (text || '').trim();
    if (!body) return;
    try{
      await addClaimMessage(id, { authorRole:'LEADER', authorName: activeClaim?.reporterName || 'Leader', text: body });
      setClaims(listClaims());
      const fresh = listClaims().find(x => x.id === id);
      setActiveClaim(fresh || null);
    }catch(e){
      setErr(e?.message || 'Unable to send message.');
      setTimeout(()=>setErr(''), 2500);
    }
  }

  async function addNote(id, text){
    const body = (text || '').trim();
    if (!body) return;
    try{
      const saved = await addClaimNote(id, 'Leader', body, { actorRole:'LEADER' });
      setClaims(listClaims());
      if (activeClaim?.id === id) setActiveClaim(saved);
    }catch(e){
      setErr(e?.message || 'Unable to add note.');
      setTimeout(()=>setErr(''), 2500);
    }
  }

  return (
    <div className="container my-3" style={{maxWidth: 1100}}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 mb-0">Claims</h1>
        {!activeClaim && (
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
        )}
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
      {!activeClaim && (
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
      )}

      {/* claims */}
      {activeClaim ? (
        <div className="card p-3 no-hover">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <div className="d-flex align-items-center gap-2">
                <h2 className="h5 mb-0">{activeClaim.claimNumber}</h2>
                {activeClaim.freshForLeader && <span className="badge bg-danger">New</span>}
              </div>
              <div className="text-muted d-flex align-items-center gap-1 flex-wrap">
                <span>{activeClaim.tripTitle || activeClaim.tripId} • {activeClaim.memberName}</span>
                {activeClaim.memberTripLeader && (
                  <span className="trip-leader-mark" title="Trip leader" aria-label="Trip leader">★</span>
                )}
              </div>
            </div>
            <button className="btn btn-outline-secondary btn-sm" onClick={()=>setActiveClaim(null)}>
              ← Back to all claims
            </button>
          </div>

          <div className="mt-3">
            <ClaimDetail
              claim={activeClaim}
              statusOptions={['SUBMITTED','IN_REVIEW','MORE_INFO','APPROVED','DENIED','CLOSED']}
              onStatusChange={updateStatus}
              onSendMessage={sendMessage}
              onAddNote={addNote}
              onClose={()=>setActiveClaim(null)}
              closeLabel="Close"
            />
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

          <div className="mt-2">
            <label className="btn btn-outline-secondary btn-sm mb-1">
              Upload file…
              <input type="file" hidden onChange={e=>e.target.files?.[0] && attachFile(activeClaim.id, e.target.files[0])}/>
            </label>
            <span className="text-muted small ms-2">{(activeClaim.attachments||[]).length} file(s)</span>
          </div>
        </div>
      ) : (
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
                  return (
                  <tr
                    key={c.id}
                    className={c.freshForLeader ? 'table-warning' : ''}
                    onClick={async ()=>{
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
                      <div className="fw-medium d-flex align-items-center gap-1">
                        <span>{c.memberName}</span>
                        {c.memberTripLeader && (
                          <span className="trip-leader-mark" title="Trip leader" aria-label="Trip leader">★</span>
                        )}
                      </div>
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
                )})}
                {filtered.length===0 && (
                  <tr><td colSpan="5" className="text-muted text-center py-4">No claims</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
