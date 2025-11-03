import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../data/api'
import { daysInclusive } from '../core/pricing'
import { listRates, createRate, seedRatesIfEmpty } from '../core/rates'
import { toCSV, download } from '../core/csv'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeSlide } from '../ui/motion'


export default function Admin(){
  // ---- Trips state ----
  const [trips, setTrips] = useState([])
  const [membersByTrip, setMembersByTrip] = useState({})
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('ACTIVE') // ACTIVE | ARCHIVED | ALL
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyTrip, setHistoryTrip] = useState(null)
  const [historyData, setHistoryData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)

  // ---- Rates state ----
  const [rates, setRates] = useState([])
  const [form, setForm] = useState({ region:'DOMESTIC', amount:'1.25', effectiveStart:'', notes:'' })

  // load trips + counts
  useEffect(()=>{
    (async()=>{
      const ts = await api.listTrips()
      setTrips(ts)
      const counts = {}
      await Promise.all(ts.map(async t=>{
        const { members } = await api.getTrip(t.id)
        counts[t.id] = members.length
      }))
      setMembersByTrip(counts)
    })()
  },[])

  // rates init
  useEffect(()=>{
    seedRatesIfEmpty()
    setRates(listRates())
  },[])

  const counts = useMemo(()=>{
    const c = { ACTIVE:0, ARCHIVED:0, ALL: trips.length }
    trips.forEach(t => { c[t.status==='ARCHIVED' ? 'ARCHIVED' : 'ACTIVE']++ })
    return c
  }, [trips])

  const filteredTrips = useMemo(()=>{
    let rows = trips
    if (scope === 'ACTIVE') rows = rows.filter(t=>t.status!=='ARCHIVED')
    if (scope === 'ARCHIVED') rows = rows.filter(t=>t.status==='ARCHIVED')
    if (q.trim()) {
      const s = q.toLowerCase()
      rows = rows.filter(t =>
        (t.title||'').toLowerCase().includes(s) ||
        (t.shortId||'').toLowerCase().includes(s)
      )
    }
    return rows
  }, [trips, scope, q])

  // quick actions
  async function markPaid(t){
    const saved = await api.updateTrip(t.id, { paymentStatus:'PAID' })
    setTrips(ts=>ts.map(x=>x.id===t.id? saved : x))
    setMsg(`Marked ${t.shortId || t.title} as PAID`)
    setTimeout(()=>setMsg(''), 2000)
  }
  async function archive(t){
    const saved = await api.updateTrip(t.id, { status:'ARCHIVED' })
    setTrips(ts=>ts.map(x=>x.id===t.id? saved : x))
  }
  async function unarchive(t){
    const saved = await api.updateTrip(t.id, { status:'ACTIVE' })
    setTrips(ts=>ts.map(x=>x.id===t.id? saved : x))
  }

  function closeHistory(){
    setHistoryOpen(false)
    setHistoryTrip(null)
    setHistoryError(null)
    setHistoryData(null)
  }

  async function viewHistory(t){
    setHistoryTrip(t)
    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await api.getTripHistory?.(t.id)
        || await api.getTripHistory(t.id)
      setHistoryData(res)
    } catch (e) {
      console.error(e)
      setHistoryError(e)
    } finally {
      setHistoryLoading(false)
    }
  }

  function downloadHistory(){
    if (!historyData || !historyTrip) return
    const events = historyData.events || []
    const rows = events.map(evt => {
      const ts = evt.timestamp ? new Date(evt.timestamp).toLocaleString() : ''
      const actor = evt.actor_role ? `${evt.actor_role}${evt.actor_id ? ' · ' + evt.actor_id : ''}` : (evt.actor_id || '—')
      return `<tr><td>${ts}</td><td>${evt.type || ''}</td><td>${actor}</td><td>${evt.notes || ''}</td></tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Trip History ${historyTrip.shortId || historyTrip.id}</title><style>body{font-family:Helvetica,Arial,sans-serif;margin:24px;}h1{font-size:20px;margin-bottom:4px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;}th{background:#f1f3f5;text-align:left;}</style></head><body><h1>Trip History</h1><p><strong>Trip:</strong> ${historyTrip.title || 'Trip'} (${historyTrip.shortId || historyTrip.id})</p><p><strong>Dates:</strong> ${historyTrip.startDate || '—'} → ${historyTrip.endDate || '—'}</p><table><thead><tr><th style="width:20%">Timestamp</th><th style="width:20%">Event</th><th style="width:20%">Actor</th><th>Notes</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No history events recorded.</td></tr>'}</tbody></table></body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  // CSV (simple)
  const tripsCSV = useMemo(()=>{
    const rows = trips.map(t=>{
      const days = daysInclusive(t.startDate, t.endDate)
      return {
        tripId: t.id,
        shortId: t.shortId,
        title: t.title,
        region: t.region,
        startDate: t.startDate,
        endDate: t.endDate,
        days,
        ratePerDayUSD: (t.rateCents/100).toFixed(2),
        members: membersByTrip[t.id] || 0,
        paymentStatus: t.paymentStatus,
        status: t.status,
        createdAt: t.createdAt
      }
    })
    return toCSV(rows)
  }, [trips, membersByTrip])

  // rates handlers
  function refreshRates(){ setRates(listRates()) }
  function addRate(e){
    e.preventDefault(); setErr(''); setMsg('')
    const cents = Math.round(parseFloat(form.amount)*100)
    if (Number.isNaN(cents) || cents <= 0) { setErr('Enter a valid amount'); return; }
    try{
      createRate({ region: form.region, amountCents: cents, effectiveStart: form.effectiveStart, notes: form.notes })
      refreshRates()
      setMsg('Rate added. New trips will snapshot based on start date.')
      setForm(f=>({...f, notes:''}))
      setTimeout(()=>setMsg(''), 2500)
    }catch(ex){ setErr(ex.message || 'Failed to add rate') }
  }

  return (
    <div className="container my-3" style={{maxWidth: 1100}}>
      <h1 className="h3 mb-3">Howdy, Admin</h1>
      {err && <div className="alert alert-danger py-2">{err}</div>}
      {msg && <div className="alert alert-success py-2">{msg}</div>}

      {/* ---- Trips section ---- */}
      <div className="card p-3 mb-4 no-hover">
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
          <h2 className="h5 mb-0">Trips</h2>
          <div className="d-flex gap-2">
            <input
              className="form-control form-control-sm"
              placeholder="Search title or #shortId…"
              style={{minWidth: 220}}
              value={q}
              onChange={e=>setQ(e.target.value)}
            />
            <div className="btn-group">
              <button className={`btn btn-sm ${scope==='ACTIVE'?'btn-secondary':'btn-outline-secondary'}`} onClick={()=>setScope('ACTIVE')}>Active ({counts.ACTIVE})</button>
              <button className={`btn btn-sm ${scope==='ARCHIVED'?'btn-secondary':'btn-outline-secondary'}`} onClick={()=>setScope('ARCHIVED')}>Archived ({counts.ARCHIVED})</button>
              <button className={`btn btn-sm ${scope==='ALL'?'btn-secondary':'btn-outline-secondary'}`} onClick={()=>setScope('ALL')}>All ({counts.ALL})</button>
            </div>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={()=>download(`trips_${new Date().toISOString().slice(0,10)}.csv`, tripsCSV)}
              title="Download CSV"
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Trip</th>
                <th>Dates</th>
                <th>Region</th>
                <th>Members</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
            <AnimatePresence>
              {filteredTrips.map(t=>{

                const days = daysInclusive(t.startDate, t.endDate)
                return (
                  <motion.tr key={t.id} {...fadeSlide}>
                    <td>
                      <div className="fw-medium">
                        <Link to={`/trips/${t.id}`} className="text-decoration-none">{t.title}</Link>
                        {t.shortId && <span className="text-muted small ms-2">#{t.shortId}</span>}
                      </div>
                      <div className="text-muted small">Rate ${ (t.rateCents/100).toFixed(2) }/day</div>
                    </td>
                    <td className="small">
                      {t.startDate} → {t.endDate}
                      <div className="text-muted">{days} days</div>
                    </td>
                    <td><span className="badge text-bg-light">{t.region}</span></td>
                    <td>{membersByTrip[t.id] || 0}</td>
                    <td>
                      <span className={`badge ${t.paymentStatus==='PAID' ? 'text-bg-success' : 'text-bg-warning'}`}>
                        {t.paymentStatus}
                      </span>
                    </td>
                    <td>
                      {t.status==='ARCHIVED'
                        ? <span className="badge text-bg-secondary">ARCHIVED</span>
                        : <span className="badge text-bg-primary-subtle text-primary">ACTIVE</span>}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Link
                          to={`/trips/${t.id}`}
                          className="btn btn-outline-secondary d-flex align-items-center justify-content-center"
                        >
                          Open
                        </Link>
                        <button
                          className="btn btn-outline-secondary d-flex align-items-center justify-content-center"
                          onClick={()=>viewHistory(t)}
                        >
                          History
                        </button>
                        {t.paymentStatus!=='PAID' && (
                          <button
                            className="btn btn-outline-success d-flex align-items-center justify-content-center"
                            onClick={()=>markPaid(t)}
                          >
                            Mark Paid
                          </button>
                        )}
                        {t.status==='ARCHIVED' ? (
                          <button
                            className="btn btn-outline-primary d-flex align-items-center justify-content-center"
                            onClick={()=>unarchive(t)}
                          >
                            Unarchive
                          </button>
                        ) : (
                          <button
                            className="btn btn-outline-secondary d-flex align-items-center justify-content-center"
                            onClick={()=>archive(t)}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          className="btn btn-outline-danger d-flex align-items-center justify-content-center"
                          onClick={async ()=>{
                            if (!confirm(`Delete trip "${t.title}" (${t.shortId||t.id})? This removes its members.`)) return;
                            await api.deleteTrip(t.id);
                            setTrips(ts => ts.filter(x => x.id !== t.id));
                            setMembersByTrip(m => { const { [t.id]:_, ...rest } = m; return rest; });
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>

              </motion.tr>
                )
              })}
              
              {filteredTrips.length===0 && (
                <tr><td colSpan="7" className="text-center text-muted py-4">No trips</td></tr>
              )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Rates Manager ---- */}
      <div className="card p-3 mb-4 no-hover">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h5 mb-0">Rates</h2>
        </div>

        <form className="row g-2" onSubmit={addRate}>
          <div className="col-md-3">
            <label className="form-label">Region</label>
            <select className="form-select" value={form.region} onChange={e=>setForm(f=>({...f, region:e.target.value}))}>
              <option value="DOMESTIC">Domestic</option>
              <option value="INTERNATIONAL">International</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Amount (USD / day)</label>
            <input className="form-control" value={form.amount} onChange={e=>setForm(f=>({...f, amount:e.target.value}))}/>
          </div>
          <div className="col-md-3">
            <label className="form-label">Effective start</label>
            <input type="date" className="form-control" value={form.effectiveStart} onChange={e=>setForm(f=>({...f, effectiveStart:e.target.value}))}/>
          </div>
          <div className="col-md-3">
            <label className="form-label">Notes</label>
            <input className="form-control" value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))}/>
          </div>
          <div className="col-12">
            <button className="btn btn-primary">Add Rate</button>
          </div>
        </form>

        <div className="table-responsive mt-3">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Region</th>
                <th>Amount</th>
                <th>Effective Start</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rates.map(r=>(
                <tr key={r.id}>
                  <td>{r.region}</td>
                  <td>${(r.amountCents/100).toFixed(2)}</td>
                  <td>{r.effectiveStart}</td>
                  <td className="text-muted">{r.notes||''}</td>
                </tr>
              ))}
              {rates.length===0 && <tr><td colSpan="4" className="text-muted">No rates yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Reports ---- */}
      <div className="card p-3 no-hover">
        <div className="d-flex align-items-center justify-content-between">
          <h2 className="h5 mb-0">Reports</h2>
          <button className="btn btn-outline-secondary btn-sm"
            onClick={()=>download(`trips_${new Date().toISOString().slice(0,10)}.csv`, tripsCSV)}>
            Download Trips CSV
          </button>
        </div>
        <p className="text-muted mt-2 mb-0">Exports a simple trips summary. Member-level CSV can be added next.</p>
      </div>
      {historyOpen && (
        <>
          <div className="modal fade show" style={{ display:'block' }} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Trip History</h5>
                  <button type="button" className="btn-close" onClick={closeHistory}></button>
                </div>
                <div className="modal-body">
                  {historyLoading && <div className="py-4 text-center">Loading history…</div>}
                  {!historyLoading && historyError && (
                    <div className="alert alert-danger">{historyError?.message || 'Unable to load history.'}</div>
                  )}
                  {!historyLoading && !historyError && historyData && historyTrip && (
                    <>
                      <div className="mb-3 small text-muted">
                        <div><strong>Trip:</strong> {historyTrip.title || 'Trip'} ({historyTrip.shortId || historyTrip.id})</div>
                        <div><strong>Dates:</strong> {historyTrip.startDate || '—'} → {historyTrip.endDate || '—'}</div>
                        <div><strong>Region:</strong> {historyTrip.region || '—'}</div>
                        <div><strong>Status:</strong> {historyTrip.status || '—'}</div>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-sm align-middle">
                          <thead>
                            <tr>
                              <th style={{width:'20%'}}>Timestamp</th>
                              <th style={{width:'20%'}}>Event</th>
                              <th style={{width:'20%'}}>Actor</th>
                              <th>Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(historyData.events || []).length === 0 ? (
                              <tr><td colSpan={4} className="text-muted">No history recorded.</td></tr>
                            ) : (
                              historyData.events.map(evt => (
                                <tr key={evt.event_id || evt.timestamp}>
                                  <td>{evt.timestamp ? new Date(evt.timestamp).toLocaleString() : '—'}</td>
                                  <td>{evt.type || '—'}</td>
                                  <td>{evt.actor_role ? `${evt.actor_role}${evt.actor_id ? ' · ' + evt.actor_id : ''}` : (evt.actor_id || '—')}</td>
                                  <td>{evt.notes || ''}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  {!historyLoading && !historyError && historyData && (
                    <button className="btn btn-outline-secondary btn-sm" onClick={downloadHistory}>Download PDF</button>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={closeHistory}>Close</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeHistory}></div>
        </>
      )}
    </div>
  )
}
