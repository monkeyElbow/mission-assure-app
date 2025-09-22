// src/pages/TripDetail.jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../data/api.local.js'
import TripMembersList from '../components/trip/TripMembersList.jsx'
import TripMemberAddForm from '../components/trip/TripMemberAddForm.jsx'
import { p } from 'framer-motion/client'


function cents(n){ return (n/100).toLocaleString(undefined,{style:'currency',currency:'USD'}) }
function daysBetween(a,b){
  const d1 = new Date(a), d2 = new Date(b)
  // inclusive day count for per-day pricing across trip span
  const ms = d2.setHours(0,0,0,0) - d1.setHours(0,0,0,0)
  return ms < 0 ? 0 : Math.floor(ms/86400000) + 1
}

export default function TripDetail(){
  const { id } = useParams()
  const nav = useNavigate()

  const [trip, setTrip] = useState(null)        // unified trip object with .members
  const [loading, setLoading] = useState(true)
  const [editingTrip, setEditingTrip] = useState(false)
  const [savingTrip, setSavingTrip] = useState(false)
  const [draft, setDraft] = useState(null)      // {title,startDate,endDate,region}



  

  async function load(){
    setLoading(true)
    const res = await api.getTrip(id)
    // Support both shapes: {trip, members} or a flat { ...trip, members:[...] }
    let merged = res && res.trip ? { ...res.trip, members: res.members || [] } : res
    if (merged && !Array.isArray(merged.members)) merged.members = []
    setTrip(merged)
    setLoading(false)
  }

  useEffect(()=>{ load() }, [id])

  // --- Payment summary (derived from current snapshot on the trip) ---
  const headcount = trip?.members?.length || 0
  const days = useMemo(()=> trip ? daysBetween(trip.startDate, trip.endDate) : 0,
                       [trip?.startDate, trip?.endDate])
  const subtotal = useMemo(()=> days * headcount * (trip?.rateCents || 0),
                           [days, headcount, trip?.rateCents])
  // If you have credits in local storage, swap this for your real calculator:
  const credit = trip?.creditsTotalCents || 0
  const balanceDue = Math.max(0, subtotal - credit)
  const tripEnded = trip ? new Date(trip.endDate) < new Date() : false
  const refundDue = tripEnded ? Math.max(0, credit - subtotal) : credit

  function startEdit(){
    setDraft({
      title: trip.title || '',
      startDate: trip.startDate || '',
      endDate: trip.endDate || '',
      region: trip.region || 'DOMESTIC'
    })
    setEditingTrip(true)
  }

  async function saveEdit(){
    setSavingTrip(true)
    try {
      // Snapshot rate on save to keep Payment Summary stable
      const rateCents = draft.region === 'INTERNATIONAL' ? 425 : 125
      await api.updateTrip(trip.id, {
        title: draft.title,
        startDate: draft.startDate,
        endDate: draft.endDate,
        region: draft.region,
        rateCents
      })
      await load()
      setEditingTrip(false)
    } finally {
      setSavingTrip(false)
    }
  }


  const [refunding, setRefunding] = useState(false);

  async function refundAllCredits() {
    if (!trip) return;
    const currentCredits = trip.creditsTotalCents || 0;
    if (currentCredits <= 0) return;
  
    if (!confirm(`Refund all credits (${(currentCredits/100).toLocaleString(undefined,{style:'currency',currency:'USD'})}) and reset to $0?`)) {
      return;
    }
  
    setRefunding(true);
    try {
      // Minimal: reset credits to zero
      await api.updateTrip(trip.id, {
        creditsTotalCents: 0,
  
        // Optional: set a status to reflect that a balance may now be due again.
        // paymentStatus: 'UNPAID',
      });
  
      await load(); // refresh trip totals/summary
    } finally {
      setRefunding(false);
    }
  }
  



  const [paying, setPaying] = useState(false); 

  async function payBalance() {
    if (!trip || balanceDue <= 0) return;
    setPaying(true);
    try {
      const newCredits = (trip.creditsTotalCents || 0) + balanceDue;
      await api.updateTrip(trip.id, {
        creditsTotalCents: newCredits,
        paymentStatus: 'PAID',
      });
      await load(); // refresh snapshot so summary updates
    } finally {
      setPaying(false);
    }
  }
  


  async function archiveTrip(){
    const saved = await api.updateTrip(trip.id, { status: 'ARCHIVED' })
    setTrip(saved)
  }
  async function unarchiveTrip(){
    const saved = await api.updateTrip(trip.id, { status: 'ACTIVE' });
    setTrip(saved);
  }
  

  if (loading) return <div className="container py-4">Loading trip…</div>
  if (!trip) return <div className="container py-4">Trip not found.</div>



  const members = Array.isArray(trip?.members) ? trip.members : [];
  const confirmedCount = members.filter(m => (m.isMinor ? m.guardianApproved : m.confirmed)).length;
  const pendingCount = members.length - confirmedCount;
    

 // ---- Receipt helpers ----
const cents = (n = 0) =>
  (n / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString() : "");
const fmtDateTime = (d) => new Date(d).toLocaleString();

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Build the snapshot from current trip state
function buildReceiptSnapshot(trip, { paymentCents = null, paidAt = null } = {}) {
  const members = Array.isArray(trip?.members) ? trip.members : [];
  const isConfirmed = (m) => (m.isMinor ? m.guardianApproved : m.confirmed);

  const confirmedMembers   = members.filter(isConfirmed);
  const unconfirmedMembers = members.filter(m => !isConfirmed(m));

  const subtotalCents = (trip?.rateCents || 0) *
                        (typeof daysInclusive === 'function' ? daysInclusive(trip?.startDate, trip?.endDate) : 0) *
                        confirmedMembers.length;

  const creditsCents = trip?.creditsTotalCents ?? 0;
  const balanceDue   = Math.max(0, subtotalCents - creditsCents);

  return {
    tripId: trip?.shortId || trip?.id,
    title: trip?.title || "Mission Assure Trip",
    region: trip?.region === "INTERNATIONAL" ? "International" : "Domestic",
    startDate: trip?.startDate, endDate: trip?.endDate,
    membersCount: members.length,
    confirmedMembers,
    unconfirmedMembers,
    subtotalCents, creditsCents, balanceDue,
    paymentCents,                          // amount paid “today” (optional)
    totalPaidToDateCents: creditsCents,    // show total paid to date
    generatedAt: new Date(), paidAt: paidAt || null,
  };
}


function openReceiptPrintWindow(data) {
  const html = renderReceiptHTML(data);
  const w = window.open("", "print-receipt", "width=900,height=1100");
  if (!w) { alert("Pop-up blocked. Allow pop-ups to print the receipt."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => setTimeout(() => w.print(), 150);
}

function renderReceiptHTML(snap) {
  const period = (snap.startDate || snap.endDate)
    ? `${fmtDate(snap.startDate)} – ${fmtDate(snap.endDate)}`
    : "Dates TBA";

  const paidState = snap.balanceDue === 0
    ? `Paid in full as of ${fmtDateTime(snap.generatedAt)}`
    : `Partial payment on file as of ${fmtDateTime(snap.generatedAt)}`;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt – ${escapeHtml(snap.title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root{ --agf1:#00A3B3; --agf2:#008AAB; --ink:#111; --muted:#666; --line:#e5e7eb; }
    *{ box-sizing:border-box; }
    body{ margin:24px; font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
      color:var(--ink); }
    .brand{ display:flex; align-items:center; gap:10px; margin-bottom:6px; }
    .brand .name{ font-weight:700; font-size:16px; color:var(--agf1); }
    .header{ display:flex; justify-content:space-between; align-items:flex-start;
      border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:16px; }
    .h1{ font-size:20px; margin:0; }
    .muted{ color:var(--muted); }
    .grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .card{ border:1px solid var(--line); border-radius:8px; padding:12px; }
    .row{ display:flex; justify-content:space-between; margin:4px 0; }
    .hr{ border-top:1px solid var(--line); margin:10px 0; }
    .paid-box{ border:2px solid var(--agf1); border-radius:10px; padding:12px; display:flex; gap:10px; align-items:center; margin-top:8px; }
    .check{ width:18px; height:18px; color:var(--agf1); }
    .mono{ font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace; }
    .legal{ margin-top:16px; font-size:12px; color:var(--muted); }
    .small{ font-size:12px; }
    .right{ text-align:right; }
    @media print{ body{ margin:10mm; } a{ color:inherit; text-decoration:none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand"><div class="name">AGFinancial – Mission Assure</div></div>
      <h1 class="h1">Payment Receipt</h1>
      <div class="muted">Trip <span class="mono">#${escapeHtml(String(snap.tripId || ""))}</span></div>
    </div>
    <div class="right small">
      <div><strong>${escapeHtml(snap.title)}</strong></div>
      <div>${escapeHtml(snap.region)} trip</div>
      <div>${period}</div>
      ${snap.leaderName ? `<div>Leader: ${escapeHtml(snap.leaderName)}</div>` : ""}
      ${snap.leaderEmail ? `<div>${escapeHtml(snap.leaderEmail)}</div>` : ""}
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="row"><span class="muted">Subtotal</span><span>${cents(snap.subtotalCents)}</span></div>
      <div class="row"><span class="muted">Credits (to date)</span><span>- ${cents(snap.creditsCents)}</span></div>
      <div class="hr"></div>
      <div class="row"><span><strong>Balance due</strong></span><span><strong>${cents(snap.balanceDue)}</strong></span></div>
      <div class="paid-box">
        <svg class="check" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
        <div>
          <div><strong>${paidState}</strong></div>

          <div class="row"><span class="muted">Total paid to date</span><span>${cents(snap.totalPaidToDateCents)}</span></div>
${
  snap.paymentCents != null
    ? `<div class="row"><span class="muted">Payment today</span><span>${cents(snap.paymentCents)}</span></div>`
    : ''
}



          <div class="small muted">Participants covered as of this receipt: ${snap.membersCount}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div><strong>Receipt details</strong></div>
      <div class="row"><span class="muted">Generated</span><span>${fmtDateTime(snap.generatedAt)}</span></div>
      <div class="row"><span class="muted">Trip ID</span><span class="mono">${escapeHtml(String(snap.tripId || ""))}</span></div>
      <div class="row"><span class="muted">Region</span><span>${escapeHtml(snap.region)}</span></div>
      <div class="row"><span class="muted">Participants</span><span>${snap.membersCount}</span></div>
    </div>
  </div>

  <div class="card" style="margin-top:16px;">
  <div><strong>Participants at time of receipt</strong></div>

  <div style="margin-top:8px;">
    <div class="small muted">COVERED (confirmed)</div>
    <ul style="margin:6px 0 10px 18px;">
      ${
        snap.confirmedMembers.length
          ? snap.confirmedMembers.map(m => `<li>${escapeHtml(`${m.firstName||''} ${m.lastName||''}`.trim())}</li>`).join('')
          : '<li>None</li>'
      }
    </ul>
  </div>

  <div>
    <div class="small muted" style="color:#B00020;"><strong>NOT COVERED (not confirmed)</strong></div>
    <ul style="margin:6px 0 0 18px;">
      ${
        snap.unconfirmedMembers.length
          ? snap.unconfirmedMembers.map(m => `<li>${escapeHtml(`${m.firstName||''} ${m.lastName||''}`.trim())}</li>`).join('')
          : '<li>None</li>'
      }
    </ul>
    <div class="small" style="margin-top:8px; color:#B00020;">
      Legal notice: Individuals listed as “Not covered” were not confirmed at the time of this receipt and are not insured under Mission Assure coverage. Coverage requires confirmation and payment prior to departure.
    </div>
  </div>
</div>


  <div class="legal">
    <strong>Important:</strong> This receipt confirms payment recorded as of ${fmtDateTime(snap.generatedAt)}.
    Coverage applies to the participants on this receipt as of this date and time.
    Add more people? Sign in at <span class="mono">missionassure.agfinancial.org</span> to purchase additional coverage before departure.
  </div>
</body>
</html>`;
}


// very small HTML escaper for safety
function escapeHtml(s="") {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}




  return (
    <div className="container py-4">
      <div className="row g-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 className="h4 mb-0">{trip.title}</h2>
            {!editingTrip && (
              <button className="btn btn-outline-secondary btn-sm" onClick={startEdit}>
                Edit Trip
              </button>
            )}
          </div>
        
     

        {/* Trip details + Payment Summary */}
        <div className="col-lg-4">
          {/* Trip Details Card */}
          <div className="card mb-3">
            <div className="card-header fw-bold">Trip details</div>
            <div className="card-body">
              {!editingTrip ? (
                <>
                  <div className="mb-2">
                    {/* <div className="text-muted small">Title</div> */}
                    <div className='fw-bold'>{trip.title}</div>
                  </div>
                  <div className="mb-2">
                    {/* <div className="text-muted small">Dates</div> */}
                    <div>{trip.startDate} → {trip.endDate} <span className="text-muted">({days} day{days===1?'':'s'})</span></div>
                  </div>
                  <div className="mb-2">
                    {/* <div className="text-muted small">Region</div> */}
                    <div>

                    <div className="d-flex justify-content-between align-items-center">
  <span className="badge bg-agf1 text-light">
    {trip.region === 'INTERNATIONAL' ? 'International' : 'Domestic'}
  </span>

  {!editingTrip && (
    <button className="ms-2 btn btn-outline-secondary btn-sm" onClick={startEdit}>
      Edit Trip
    </button>
  )}
</div>


                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="form-label">Title</label>
                    <input className="form-control" value={draft.title}
                           onChange={e=>setDraft({...draft, title:e.target.value})} />
                  </div>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">Start date</label>
                      <input type="date" className="form-control" value={draft.startDate}
                             onChange={e=>setDraft({...draft, startDate:e.target.value})}/>
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">End date</label>
                      <input type="date" className="form-control" value={draft.endDate}
                             onChange={e=>setDraft({...draft, endDate:e.target.value})}/>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="form-label">Region</div>
                    <div className="d-flex gap-3">
                      <label className="form-check">
                        <input className="form-check-input" type="radio"
                               checked={draft.region==='DOMESTIC'}
                               onChange={()=>setDraft({...draft, region:'DOMESTIC'})}/>
                        <span className="form-check-label ms-2">Domestic ($1.25/day)</span>
                      </label>
                      <label className="form-check">
                        <input className="form-check-input" type="radio"
                               checked={draft.region==='INTERNATIONAL'}
                               onChange={()=>setDraft({...draft, region:'INTERNATIONAL'})}/>
                        <span className="form-check-label ms-2">International ($4.25/day)</span>
                      </label>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button className="btn btn-primary" onClick={saveEdit} disabled={savingTrip}>
                      {savingTrip ? 'Saving…' : 'Save changes'}
                    </button>
                    <button className="btn btn-outline-secondary" onClick={()=>setEditingTrip(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-outline-warning ms-auto" onClick={archiveTrip}>
                      Archive trip
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>



          {/* Payment Summary Card */}
          <div className="card">
            <div className="card-header fw-bold">Payment summary</div>
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <span className="text-muted">Confirmed People</span>
                <strong>{confirmedCount}</strong>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Days</span>
                <strong>{days}</strong>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Rate</span>
                <strong>{cents(trip.rateCents || 0)} / person / day</strong>
              </div>


{ balanceDue === 0 && headcount > 0 ? (
  <>
{/* PAID UP - PRINT RECEIPT */}
<div className='my-5'>
  <p className='h5'>Balance is paid. Godspeed on your trip.</p>
  <button
  type="button"
  className="btn btn-outline-secondary w-100 mt-2"
  onClick={() => {
    const snap = buildReceiptSnapshot(trip);
    openReceiptPrintWindow(snap);
  }}
>
  Print receipt
</button>
</div>  </>
) : (
  <>







              <hr/>
              <div className="d-flex justify-content-between">
                <span>Subtotal</span>
                <strong>{cents(subtotal)}</strong>
              </div>
              <div className="d-flex justify-content-between">
                <span>Trip Credits</span>
                <strong>- {cents(credit)}</strong>
              </div>
              <hr/>
              </>
              )}

              {refundDue > 0 ? (
                <>
                  <div className="d-flex justify-content-between">
                    <span className="text-success">Refund due</span>
                    <strong className="text-success">{cents(refundDue)}</strong>
                  </div>
                  <button className="btn btn-outline-success w-100 mt-2"
                    disabled={(trip?.creditsTotalCents || 0) === 0 || refunding}
                    onClick={refundAllCredits}
                  >
                    Request refund {cents(refundDue)}
                  </button>
                  <p className='small text-center'>Refunds can be initiated after the first date of the trip</p>
                </>
              ) : (
                <>
                  <div className="d-flex justify-content-between">
                    <span className="text-danger">Balance due</span>
                    <strong className="text-danger">{cents(balanceDue)}</strong>
                  </div>
                 
                  <button
  className="btn btn-primary btn-pay w-100 mt-2"
  disabled={confirmedCount === 0 || balanceDue === 0 || paying}
  onClick={payBalance}
>
  {paying ? 'Paying…' : `Pay ${cents(balanceDue)}`}
</button>



                </>
              )}
            </div>
          </div>
        </div>





        
           {/* Members */}
           <div className="col-lg-8">
    {trip.status !== 'ARCHIVED' && (
      <div className="mb-3">
        <TripMemberAddForm tripId={trip.id} onAdded={load} />
      </div>
    )}
          <TripMembersList trip={trip} members={trip.members} onChanged={load} />
        </div>
        
      </div>
    </div>
  )
}
