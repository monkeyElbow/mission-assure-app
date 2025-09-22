// src/pages/Claims.jsx
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../data/api'
import { listClaims, createClaim, updateClaim, addClaimAttachment } from '../core/claims'

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
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')

  // wizard state
  const emptyForm = {
    tripId:'', tripTitle:'',
    memberName:'', memberEmail:'',
    reporterName:'', reporterEmail:'', role:'LEADER',
    incidentDate:'', incidentLocation:'', incidentType:'Injury', description:''
  }
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(emptyForm)

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
      setForm(f => ({
        ...f,
        tripId: t?.id || '',
        tripTitle: t?.title || (loc.state?.tripTitle || '')
      }))
      setStep(1)
      setShowWizard(true)
    }
  }, [loc.state, trips])

  const filtered = useMemo(
    ()=> filter==='ALL' ? claims : claims.filter(c=>c.status===filter),
    [claims, filter]
  )

  function resetWizard(){
    setForm(emptyForm); setStep(1); setShowWizard(false); setErr(''); setSuccess('');
  }

  async function submitClaim(){
    setErr(''); setSuccess('');
    try{
      const trip = trips.find(t=>t.id===form.tripId)
      const row = createClaim({
        ...form,
        tripTitle: trip?.title || form.tripTitle
      })
      setClaims(listClaims())
      setSuccess(`Claim ${row.claimNumber} submitted.`)
      resetWizard()
    }catch(ex){
      setErr(ex.message || 'Failed to submit claim')
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
        <button className="btn btn-primary" onClick={()=>setShowWizard(true)}>Report a Claim</button>
      </div>

      {err && <div className="alert alert-danger py-2">{err}</div>}
      {success && <div className="alert alert-success py-2">{success}</div>}

      {/* filters */}
      <div className="d-flex gap-2 mb-2">
        {['ALL','SUBMITTED','IN_REVIEW','MORE_INFO','APPROVED','DENIED','CLOSED'].map(s=>(
          <button key={s}
            className={`btn btn-sm ${filter===s?'btn-secondary':'btn-outline-secondary'}`}
            onClick={()=>setFilter(s)}>{s.replace('_',' ')}</button>
        ))}
      </div>

      {/* claims table */}
      <div className="card p-0">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Claim #</th>
                <th>Trip</th>
                <th>Member</th>
                <th>Reported By</th>
                <th>Incident</th>
                <th>Status</th>
                <th>Files</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c=>(
                <tr key={c.id}>
                  <td className="fw-medium">{c.claimNumber}</td>
                  <td>{c.tripTitle || c.tripId}</td>
                  <td>{c.memberName} <span className="text-muted small">{c.memberEmail}</span></td>
                  <td>{c.reporterName} <span className="text-muted small">({c.role})</span></td>
                  <td>
                    <div className="small">{c.incidentType} — {c.incidentDate}</div>
                    <div className="text-muted small">{c.incidentLocation}</div>
                  </td>
                  <td>
                    <select className="form-select form-select-sm"
                      value={c.status}
                      onChange={e=>{ updateClaim(c.id, { status: e.target.value }); setClaims(listClaims()); }}>
                      {['SUBMITTED','IN_REVIEW','MORE_INFO','APPROVED','DENIED','CLOSED'].map(s=>
                        <option key={s} value={s}>{s.replace('_',' ')}</option>
                      )}
                    </select>
                  </td>
                  <td>
                    <label className="btn btn-outline-secondary btn-sm mb-1">
                      Upload…
                      <input type="file" hidden onChange={e=>e.target.files?.[0] && attachFile(c.id, e.target.files[0])}/>
                    </label>
                    <div className="small text-muted">{(c.attachments||[]).length} file(s)</div>
                  </td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td colSpan="7" className="text-muted text-center py-4">No claims</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wizard modal (simple inline) */}
      {showWizard && (
        <div className="position-fixed top-0 start-0 w-100 h-100" style={{background:'rgba(0,0,0,.35)'}}>
          <div className="d-flex align-items-center justify-content-center h-100">
            <div className="card" style={{width: 680}}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h2 className="h5 mb-0">Report a Claim</h2>
                  <button className="btn btn-sm btn-outline-secondary" onClick={resetWizard}>Close</button>
                </div>

                {/* Step 1: Trip + member */}
                {step===1 && (
                  <div className="row g-2">
                    <div className="col-12">
                      <label className="form-label">Trip</label>
                      <select className="form-select"
                        value={form.tripId}
                        onChange={e=>{
                          const t = trips.find(tt=>tt.id===e.target.value)
                          setForm(f=>({...f, tripId: e.target.value, tripTitle: t?.title || ''}))
                        }}>
                        <option value="">Select a trip…</option>
                        {trips.map(t=>(
                          <option key={t.id} value={t.id}>{t.title} ({t.startDate} → {t.endDate})</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Member name</label>
                      <input className="form-control" placeholder="e.g., Ana Ray"
                        value={form.memberName}
                        onChange={e=>setForm(f=>({...f, memberName:e.target.value}))}/>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Member email</label>
                      <input type="email" className="form-control"
                        value={form.memberEmail}
                        onChange={e=>setForm(f=>({...f, memberEmail:e.target.value}))}/>
                    </div>
                    <div className="col-12 d-flex justify-content-end">
                      <button className="btn btn-primary" onClick={()=>setStep(2)} disabled={!form.tripId}>Next</button>
                    </div>
                  </div>
                )}

                {/* Step 2: Reporter */}
                {step===2 && (
                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label">Your name</label>
                      <input className="form-control" value={form.reporterName} onChange={e=>setForm(f=>({...f, reporterName:e.target.value}))}/>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Your email</label>
                      <input type="email" className="form-control" value={form.reporterEmail} onChange={e=>setForm(f=>({...f, reporterEmail:e.target.value}))}/>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Your role</label>
                      <select className="form-select" value={form.role} onChange={e=>setForm(f=>({...f, role:e.target.value}))}>
                        <option value="LEADER">Leader</option>
                        <option value="MEMBER">Member</option>
                      </select>
                    </div>
                    <div className="col-12 d-flex justify-content-between">
                      <button className="btn btn-outline-secondary" onClick={()=>setStep(1)}>Back</button>
                      <button className="btn btn-primary" onClick={()=>setStep(3)} disabled={!form.reporterName || !form.reporterEmail}>Next</button>
                    </div>
                  </div>
                )}

                {/* Step 3: Incident */}
                {step===3 && (
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label">Incident date</label>
                      <input type="date" className="form-control" value={form.incidentDate} onChange={e=>setForm(f=>({...f, incidentDate:e.target.value}))}/>
                    </div>
                    <div className="col-md-8">
                      <label className="form-label">Location</label>
                      <input className="form-control" placeholder="City, State / Country"
                        value={form.incidentLocation}
                        onChange={e=>setForm(f=>({...f, incidentLocation:e.target.value}))}/>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Incident type</label>
                      <select className="form-select" value={form.incidentType} onChange={e=>setForm(f=>({...f, incidentType:e.target.value}))}>
                        <option>Injury</option>
                        <option>Illness</option>
                        <option>Property</option>
                        <option>Travel Delay</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea className="form-control" rows="4" value={form.description} onChange={e=>setForm(f=>({...f, description:e.target.value}))}/>
                    </div>
                    <div className="col-12 d-flex justify-content-between">
                      <button className="btn btn-outline-secondary" onClick={()=>setStep(2)}>Back</button>
                      <button className="btn btn-primary" onClick={submitClaim} disabled={!form.incidentDate || !form.description}>Submit Claim</button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
