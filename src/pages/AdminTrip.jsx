import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import InlineNotice from '../components/InlineNotice.jsx'
import { api } from '../data/api'
import { useRosterSummary } from '../data/useRosterSummary'
import { listClaims, markClaimSeen, updateClaim, addClaimNote, addClaimMessage } from '../core/claims'
import { daysInclusive } from '../core/pricing'
import TripMemberAddForm from '../components/trip/TripMemberAddForm.jsx'
import ClaimDetail from '../components/claims/ClaimDetail.jsx'

function formatDate(d){
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function formatUsd(cents = 0){
  const dollars = Number(cents || 0) / 100;
  return `$${dollars.toFixed(2)}`;
}

function nameFor(member){
  const first = member?.first_name || member?.firstName || '';
  const last = member?.last_name || member?.lastName || '';
  return [first, last].filter(Boolean).join(' ').trim() || member?.email || `Traveler ${member?.id || ''}`;
}

export default function AdminTrip(){
  const { id } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [claims, setClaims] = useState([]);
  const [claimDetailId, setClaimDetailId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [payDraft, setPayDraft] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundDraft, setRefundDraft] = useState('');
  const [readySearch, setReadySearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [readyPage, setReadyPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [travelerTab, setTravelerTab] = useState('READY'); // READY | WAITING
  const [printing, setPrinting] = useState(false);

  const roster = useRosterSummary(id);

  // Pull trip + claims on load
  useEffect(() => {
    refresh();
  }, [id]);

  // Load saved notes per trip (local only for demo)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`admin_notes_${id}`);
      if (raw) setNotes(JSON.parse(raw));
      else setNotes([]);
    } catch (e) {
      console.warn('Unable to load admin notes', e);
      setNotes([]);
    }
  }, [id]);

  const ready = roster.ready || [];
  const pending = roster.pending || [];
  const pageSize = 6;

  const paymentStatus = (trip?.paymentStatus || 'UNPAID').toUpperCase();
  const statusBadge = paymentStatus === 'PAID' ? 'bg-agf2 text-white' : 'bg-warning text-dark';
  const tripStatus = (trip?.status || 'ACTIVE').toUpperCase();

  const tripClaims = useMemo(
    () => claims.filter(c => String(c.tripId) === String(id)),
    [claims, id]
  );

  async function refresh(){
    setErr('');
    setLoading(true);
    try {
      const res = await api.getTrip(id);
      setTrip(res.trip);
      setClaims(listClaims());
    } catch (e) {
      setErr(e?.message || 'Unable to load trip.');
    } finally {
      setLoading(false);
    }
  }

  function persistNotes(next){
    setNotes(next);
    try {
      localStorage.setItem(`admin_notes_${id}`, JSON.stringify(next));
    } catch (e) {
      console.warn('Unable to persist admin notes', e);
    }
  }

  function addNote(){
    const text = noteDraft.trim();
    if (!text) return;
    const entry = { text, createdAt: new Date().toISOString() };
    const next = [entry, ...notes];
    persistNotes(next);
    setNoteDraft('');
  }

  async function togglePaid(){
    if (!trip) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const nextStatus = trip.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID';
      const saved = await api.updateTrip(trip.id, { paymentStatus: nextStatus });
      setTrip(saved);
      setMsg(`Marked ${saved.shortId || saved.title} as ${nextStatus}`);
    } catch (e) {
      setErr(e?.message || 'Unable to update payment.');
    } finally {
      setBusy(false);
      setTimeout(()=>setMsg(''), 2500);
    }
  }

  async function toggleArchive(){
    if (!trip) return;
    setBusy(true); setErr('');
    try {
      const nextStatus = trip.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
      const saved = await api.updateTrip(trip.id, { status: nextStatus });
      setTrip(saved);
      setMsg(`Trip ${nextStatus === 'ARCHIVED' ? 'archived' : 'restored'}.`);
      setTimeout(()=>setMsg(''), 2000);
    } catch (e) {
      setErr(e?.message || 'Unable to update status.');
    } finally {
      setBusy(false);
    }
  }

  function seatPriceCents(){
    if (!trip) return 0;
    if (trip.spot_price_cents) return trip.spot_price_cents;
    const perDay = Number(trip.rateCents || 0);
    const days = daysInclusive(trip.startDate, trip.endDate);
    return perDay * days;
  }

  const creditsCents = Number(trip?.creditsTotalCents || 0);
  const seatCost = seatPriceCents();
  const travelersCount = (roster.coveredCount || 0) + (roster.pendingCount || 0);
  const owedCents = Math.max(0, (seatCost * travelersCount) - creditsCents);
  const extraSeats = roster.data?.extraSeats || 0;
  const refundableAmount = Number(roster.data?.refundableAmount || 0);
  const canRefund = !!roster.data?.canRefund && refundableAmount > 0;

  const filteredReady = useMemo(() => {
    const term = readySearch.trim().toLowerCase();
    if (!term) return ready;
    return ready.filter(m => {
      const hay = `${nameFor(m)} ${m.email || ''} ${m.phone || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [ready, readySearch]);

  const filteredPending = useMemo(() => {
    const term = pendingSearch.trim().toLowerCase();
    if (!term) return pending;
    return pending.filter(m => {
      const hay = `${nameFor(m)} ${m.email || ''} ${m.phone || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [pending, pendingSearch]);

  useEffect(() => { setReadyPage(1); }, [readySearch, ready.length]);
  useEffect(() => { setPendingPage(1); }, [pendingSearch, pending.length]);

  const readyPagination = useMemo(() => {
    const total = Math.max(1, Math.ceil(filteredReady.length / pageSize));
    const page = Math.min(readyPage, total);
    const start = (page - 1) * pageSize;
    return { total, page, start, end: Math.min(filteredReady.length, start + pageSize), rows: filteredReady.slice(start, start + pageSize) };
  }, [filteredReady, readyPage]);

  const pendingPagination = useMemo(() => {
    const total = Math.max(1, Math.ceil(filteredPending.length / pageSize));
    const page = Math.min(pendingPage, total);
    const start = (page - 1) * pageSize;
    return { total, page, start, end: Math.min(filteredPending.length, start + pageSize), rows: filteredPending.slice(start, start + pageSize) };
  }, [filteredPending, pendingPage]);

  const activeTabList = travelerTab === 'READY' ? filteredReady : filteredPending;
  const activePagination = travelerTab === 'READY' ? readyPagination : pendingPagination;
  const activeSearch = travelerTab === 'READY' ? readySearch : pendingSearch;
  const setActiveSearch = travelerTab === 'READY' ? setReadySearch : setPendingSearch;

  async function syncCoverage(){
    if (!trip) return;
    setBusy(true); setErr('');
    try {
      await api.syncCoverageInventory?.(trip.id);
      await roster.refresh();
      setMsg('Coverage synced.');
      setTimeout(()=>setMsg(''), 2000);
    } catch (e) {
      setErr(e?.message || 'Unable to sync coverage.');
    } finally {
      setBusy(false);
    }
  }

  async function updateClaimStatusLocal(claimId, status){
    try {
      await updateClaim(claimId, { status });
      setClaims(listClaims());
      markClaimSeen(claimId, 'ADMIN');
      setMsg(`Claim updated to ${status.replace('_',' ')}`);
      setTimeout(()=>setMsg(''), 2000);
    } catch (e) {
      setErr(e?.message || 'Unable to update claim.');
    }
  }

  function toggleClaimDetail(id) {
    setClaimDetailId(prev => prev === id ? null : id);
    markClaimSeen(id, 'ADMIN');
    setClaims(listClaims());
  }

  async function submitClaimNote(id, text){
    const body = (text || '').trim();
    if (!body) return;
    try{
      const saved = await addClaimNote(id, 'Admin', body, { actorRole:'ADMIN' });
      setClaims(listClaims());
      if (claimDetailId === id) {
        const fresh = listClaims().find(c => c.id === id);
        if (fresh) setClaimDetailId(id); // keep open
      }
    }catch(e){
      setErr(e?.message || 'Unable to add note.');
      setTimeout(()=>setErr(''), 3000);
    }
  }

  async function submitClaimMessage(id, text){
    const body = (text || '').trim();
    if (!body) return;
    try{
      await addClaimMessage(id, { authorRole:'ADMIN', authorName:'Admin', text: body });
      setClaims(listClaims());
    }catch(e){
      setErr(e?.message || 'Unable to send message.');
      setTimeout(()=>setErr(''), 3000);
    }
  }

  async function openHistory(){
    if (!trip) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    try{
      const res = await api.getTripHistory?.(trip.id) || await api.getTripHistory(trip.id);
      setHistoryData(res);
    }catch(e){
      console.error(e);
      setHistoryError(e);
    }finally{
      setHistoryLoading(false);
    }
  }

  function closeHistory(){
    setHistoryOpen(false);
    setHistoryData(null);
    setHistoryError(null);
  }

  async function deleteTrip(){
    if (!trip) return;
    const confirmed = window.confirm('Delete this trip and all travelers? This cannot be undone.');
    if (!confirmed) return;
    try{
      await api.deleteTrip(trip.id);
      navigate('/admin');
    }catch(e){
      setErr(e?.message || 'Failed to delete trip.');
      setTimeout(()=>setErr(''), 3000);
    }
  }

  async function approveTraveler(member){
    const memberId = member?.id ?? member?.member_id;
    if (!memberId) return;
    setBusy(true); setErr('');
    try{
      await api.updateMember(memberId, {
        confirmed: true,
        is_confirmed: true,
        confirmedAt: new Date().toISOString(),
        active: true
      });
      await roster.refresh();
      setMsg('Traveler approved.');
      setTimeout(()=>setMsg(''), 2000);
    }catch(e){
      setErr(e?.message || 'Unable to approve traveler.');
      setTimeout(()=>setErr(''), 3000);
    }finally{
      setBusy(false);
    }
  }

  async function refundAmount(){
    const defaultRefund = refundableAmount > 0 ? refundableAmount / 100 : creditsCents / 100;
    const amt = parseFloat(refundDraft || defaultRefund);
    if (Number.isNaN(amt) || amt <= 0) {
      setErr('Enter a valid refund amount.');
      setTimeout(()=>setErr(''), 2500);
      return;
    }
    setRefundLoading(true); setErr(''); setMsg('');
    try{
      const cents = Math.round(amt * 100);
      await api.applyPayment(trip.id, -cents, { autoAllocate: true });
      const res = await api.getTrip(trip.id);
      setTrip(res.trip);
      await roster.refresh();
      setMsg(`Refunded ${formatUsd(cents)}.`);
      setRefundDraft('');
      setTimeout(()=>setMsg(''), 2000);
    }catch(e){
      setErr(e?.message || 'Unable to process refund.');
      setTimeout(()=>setErr(''), 3000);
    }finally{
      setRefundLoading(false);
    }
  }

  async function applyPayment(){
    const amt = parseFloat(payDraft || owedCents / 100);
    if (Number.isNaN(amt) || amt <= 0) {
      setErr('Enter a valid payment amount.');
      setTimeout(()=>setErr(''), 2500);
      return;
    }
    setBusy(true); setErr(''); setMsg('');
    try{
      const cents = Math.round(amt * 100);
      await api.applyPayment(trip.id, cents, { autoAllocate: true });
      const res = await api.getTrip(trip.id);
      setTrip(res.trip);
      await roster.refresh();
      setMsg(`Applied payment of ${formatUsd(cents)}.`);
      setPayDraft('');
      setTimeout(()=>setMsg(''), 2000);
    }catch(e){
      setErr(e?.message || 'Unable to apply payment.');
      setTimeout(()=>setErr(''), 3000);
    }finally{
      setBusy(false);
    }
  }

  function printClaim(claim){
    try{
      const html = renderClaimHTML(claim);
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }catch(e){
      console.error('Unable to print claim', e);
      setErr('Unable to open print view.');
      setTimeout(()=>setErr(''), 2500);
    }
  }

  function renderClaimHTML(c){
    if (!c) return '';
    const fmt = (d) => d ? new Date(d).toLocaleString() : '—';
    const safe = (s) => (s || '').toString();
    const msgList = (c.messages || []).map(m => `
      <tr><td>${fmt(m.createdAt)}</td><td>${safe(m.authorName || m.authorRole || 'User')}</td><td>${safe(m.text)}</td></tr>
    `).join('') || '<tr><td colspan="3">No messages</td></tr>';
    const noteList = (c.notes || []).map(n => `
      <tr><td>${fmt(n.createdAt)}</td><td>${safe(n.author || 'Admin')}</td><td>${safe(n.text)}</td></tr>
    `).join('') || '<tr><td colspan="3">No admin notes</td></tr>';
    const attachList = (c.attachments || []).map(a => `<li>${safe(a.filename)}${a.size ? ` (${(a.size/1024).toFixed(1)} KB)` : ''}</li>`).join('') || '<li>None</li>';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Claim ${safe(c.claimNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    h1 { margin: 0 0 8px; }
    .sub { color: #555; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
    .section { margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Claim ${safe(c.claimNumber)}</h1>
  <div class="sub">Trip: ${safe(c.tripTitle || c.tripId)} • Member: ${safe(c.memberName || 'Traveler')} (${safe(c.memberEmail || '—')})</div>

  <div class="section">
    <div><strong>Status:</strong> ${safe(c.status || '—')}</div>
    <div><strong>Incident:</strong> ${safe(c.incidentType || 'Incident')} ${c.incidentDate ? `on ${fmt(c.incidentDate)}` : ''} ${c.incidentLocation ? `@ ${safe(c.incidentLocation)}` : ''}</div>
    <div style="margin-top:6px;"><strong>Description:</strong><br/>${safe(c.incidentDescription || c.description || 'No description provided.')}</div>
    <div style="margin-top:6px;"><strong>Attachments:</strong><ul>${attachList}</ul></div>
  </div>

  <div class="section">
    <h3 style="margin:8px 0 4px;">Messages (leader-visible)</h3>
    <table><thead><tr><th style="width:26%">Timestamp</th><th style="width:20%">Author</th><th>Text</th></tr></thead><tbody>${msgList}</tbody></table>
  </div>

  <div class="section">
    <h3 style="margin:8px 0 4px;">Admin Notes (internal)</h3>
    <table><thead><tr><th style="width:26%">Timestamp</th><th style="width:20%">Author</th><th>Text</th></tr></thead><tbody>${noteList}</tbody></table>
  </div>
</body>
</html>`;
  }

  if (loading && !trip) {
    return (
      <div className="container my-4" style={{ maxWidth: 1100 }}>
        <p>Loading trip…</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="container my-4" style={{ maxWidth: 1100 }}>
        <InlineNotice tone="danger" className="mb-3">Trip not found.</InlineNotice>
        <Link to="/admin" className="btn btn-outline-secondary">Back to admin</Link>
      </div>
    );
  }

  const coveredCount = roster.coveredCount || 0;
  const pendingCount = roster.pendingCount || 0;
  const readyPct = coveredCount + pendingCount === 0 ? 0 : Math.round((coveredCount / (coveredCount + pendingCount)) * 100);
  const openClaims = tripClaims.filter(c => ['SUBMITTED','IN_REVIEW','MORE_INFO'].includes(c.status));

  return (
    <div className="container my-3" style={{ maxWidth: 1200 }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 w-100">
            <div>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <h1 className="h4 mb-0">{trip.title || 'Trip'}</h1>
                {trip.shortId && <span className="badge text-bg-light">#{trip.shortId}</span>}
                <span className={`badge ${tripStatus === 'ARCHIVED' ? 'text-bg-secondary' : 'text-bg-primary-subtle'}`}>
                  {tripStatus}
                </span>
                <span className={`badge ${statusBadge}`}>{paymentStatus}</span>
              </div>
              <div className="text-muted small">
                {formatDate(trip.startDate)} → {formatDate(trip.endDate)} · {trip.region} · Rate {trip.rateCents ? formatUsd(trip.rateCents) : '—'}/day · Created {trip.createdAt ? formatDate(trip.createdAt) : '—'}
              </div>
            </div>
            <div className="btn-group btn-group-sm align-self-start btn-group-tight" role="group">
              <button className="btn btn-outline-secondary" onClick={() => navigate('/admin')}>← Back to trips</button>
              <Link className="btn btn-outline-secondary" to={`/trips/${trip.id}`} target="_blank" rel="noreferrer">Leader View</Link>
              <button className="btn btn-outline-primary" onClick={togglePaid} disabled={busy}>
                {paymentStatus === 'PAID' ? 'Mark unpaid' : 'Mark paid'}
              </button>
              <button className="btn btn-outline-dark" onClick={toggleArchive} disabled={busy}>
                {tripStatus === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
              </button>
              <button className="btn btn-outline-secondary" onClick={openHistory}>History</button>
              <button className="btn btn-outline-danger" onClick={deleteTrip}>Delete</button>
            </div>
          </div>
      </div>

      {err && <InlineNotice tone="danger" dismissible className="mb-2">{err}</InlineNotice>}
      {msg && <InlineNotice tone="success" dismissible className="mb-2">{msg}</InlineNotice>}

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="fw-semibold">Progress</div>
                <span className="badge text-bg-light">{readyPct}% ready</span>
              </div>
              <div className="progress" style={{ height: 10 }}>
                <div className="progress-bar bg-agf2" role="progressbar" style={{ width: `${readyPct}%` }} aria-valuenow={readyPct} aria-valuemin="0" aria-valuemax="100"></div>
              </div>
              <ul className="list-unstyled small mt-3 mb-0">
                <li><strong>{coveredCount}</strong> ready</li>
                <li><strong>{pendingCount}</strong> waiting</li>
                <li><strong>{roster.unassignedSpots}</strong> unassigned seats</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="fw-semibold mb-1">Payments</div>
              <div className="small text-muted mb-2">
                Seat price: {seatCost ? formatUsd(seatCost) : '—'} · Travelers counted: {travelersCount}<br/>
                Credits: {formatUsd(creditsCents)} · Balance due: <strong>{formatUsd(owedCents)}</strong>
              </div>
              <label className="form-label small mb-1">Apply payment (USD)</label>
              <div className="d-flex gap-2 align-items-end">
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={payDraft}
                  placeholder={(owedCents/100).toFixed(2)}
                  onChange={e=>setPayDraft(e.target.value)}
                />
                <button className="btn btn-primary btn-sm" onClick={applyPayment} disabled={busy}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="fw-semibold mb-1">Refunds</div>
              <div className="small text-muted mb-2">
                Credits available: {formatUsd(creditsCents)}<br/>
                Extra seats: {extraSeats} {canRefund && `(Refundable ${formatUsd(refundableAmount)})`}
              </div>
              <label className="form-label small mb-1">Refund amount (USD)</label>
              <div className="d-flex gap-2 align-items-start">
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={refundDraft}
                  placeholder={(refundableAmount/100 || creditsCents/100).toFixed(2)}
                  onChange={e=>setRefundDraft(e.target.value)}
                />
                <div className="d-flex flex-column gap-1">
                  <button className="btn btn-outline-danger btn-sm" onClick={refundAmount} disabled={refundLoading}>
                    {refundLoading ? 'Processing…' : 'Refund'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12">
          <div className="card mb-3">
            <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div className="fw-semibold">Travelers</div>
              <div className="btn-group btn-group-sm">
                <button
                  className={`btn ${travelerTab === 'READY' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => setTravelerTab('READY')}
                >
                  Ready ({coveredCount})
                </button>
                <button
                  className={`btn ${travelerTab === 'WAITING' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => setTravelerTab('WAITING')}
                >
                  Waiting ({pendingCount})
                </button>
              </div>
            </div>
            <div className="p-3 pb-2">
              <input
                className="form-control form-control-sm"
                placeholder={travelerTab === 'READY' ? 'Search ready travelers…' : 'Search waiting travelers…'}
                value={activeSearch}
                onChange={e=>setActiveSearch(e.target.value)}
              />
            </div>
            <div className="list-group list-group-flush pt-2" style={{ maxHeight: 360, overflowY: 'auto', padding: '4px 0 10px 0' }}>
              {roster.loading ? (
                <div className="p-3 text-muted small">Loading travelers…</div>
              ) : activeTabList.length === 0 ? (
                <div className="p-3 text-muted small">No travelers in this tab.</div>
              ) : (
                activePagination.rows.map(m => {
                  const content = (
                    <>
                      <div className="fw-semibold">{nameFor(m)}</div>
                      <div className="text-muted small">{m.email || '—'} {m.phone ? `· ${m.phone}` : ''}</div>
                    </>
                  );
                  if (travelerTab === 'READY') {
                    return (
                      <div key={m.id} className="list-group-item">
                        {content}
                        <div className="d-flex gap-2 align-items-center small mt-1 flex-wrap">
                          <span className="badge text-bg-success">Paid & covered</span>
                          {m.guardianName && <span className="badge text-bg-light">Guardian: {m.guardianName}</span>}
                          {m.coverage_as_of && <span className="text-muted">since {formatDate(m.coverage_as_of)}</span>}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          {content}
                          <div className="small">
                            {m.eligible ? <span className="badge text-bg-info">Confirmed</span> : <span className="badge text-bg-light text-dark">Needs confirmation</span>}
                            {m.is_minor && !m.guardianApproved && <span className="badge text-bg-warning text-dark ms-2">Guardian pending</span>}
                          </div>
                        </div>
                        <div className="d-flex flex-column align-items-end gap-1">
                          {m.eligible ? (
                            <span className="badge bg-agf2 text-white">Ready to assign</span>
                          ) : (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => approveTraveler(m)}
                              disabled={busy}
                            >
                              Approve traveler
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {activeTabList.length > pageSize && (
              <div className="d-flex justify-content-between align-items-center px-3 py-2">
                <div className="text-muted small">
                  Showing {activePagination.start + 1}–{activePagination.end} of {activeTabList.length}
                </div>
                <div className="btn-group btn-group-sm">
                  <button className="btn btn-outline-secondary" disabled={activePagination.page <= 1} onClick={()=>{
                    if (travelerTab === 'READY') setReadyPage(p=>Math.max(1, p-1));
                    else setPendingPage(p=>Math.max(1, p-1));
                  }}>←</button>
                  <span className="btn btn-outline-light text-dark disabled">Page {activePagination.page}/{activePagination.total}</span>
                  <button className="btn btn-outline-secondary" disabled={activePagination.page >= activePagination.total} onClick={()=>{
                    if (travelerTab === 'READY') setReadyPage(p=>Math.min(activePagination.total, p+1));
                    else setPendingPage(p=>Math.min(activePagination.total, p+1));
                  }}>→</button>
                </div>
              </div>
            )}
            <div className="border-top p-3">
              <div className="fw-semibold small mb-2">Add traveler</div>
              <TripMemberAddForm
                tripId={trip.id}
                compact
                onAdded={() => {
                  roster.refresh();
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="fw-semibold">Claims & follow-up</div>
          <span className="badge text-bg-light">{tripClaims.length} total</span>
        </div>
        <div className="card-body">
          {tripClaims.length === 0 ? (
            <div className="text-muted small">No claims on this trip.</div>
          ) : (
            <ul className="list-unstyled small mb-0 admin-claims-list">
              {tripClaims.map(c => (
                <li key={c.id} className="border p-3 mb-2 admin-claim-row">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <div className="fw-semibold d-flex align-items-center gap-2">
                        {c.claimNumber}
                        {c.freshForAdmin && <span className="badge bg-danger">New</span>}
                      </div>
                      <div className="text-muted">{c.memberName || 'Traveler'}</div>
                      <div className="text-muted mt-1">{c.incidentType || 'Incident'} {c.incidentDate ? `· ${formatDate(c.incidentDate)}` : ''}</div>
                    </div>
                          <div className="d-flex flex-column align-items-end gap-1" style={{ minWidth: '46%' }}>
                            <select
                              className="form-select form-select-sm"
                              value={c.status}
                              onChange={e => updateClaimStatusLocal(c.id, e.target.value)}
                            >
                              {['SUBMITTED','IN_REVIEW','MORE_INFO','APPROVED','DENIED','CLOSED'].map(s => (
                                <option key={s} value={s}>{s.replace('_',' ')}</option>
                              ))}
                            </select>
                            <div className="d-flex gap-2">
                            <button className="btn btn-link btn-sm p-0" onClick={() => toggleClaimDetail(c.id)}>
                              {claimDetailId === c.id ? 'Close' : 'Details'}
                            </button>
                            <button className="btn btn-link btn-sm p-0" onClick={() => printClaim(c)}>
                              Print/PDF
                            </button>
                          </div>
                        </div>
                      </div>
                  {claimDetailId === c.id && (
                    <div className="mt-2 border-top pt-2">
                      <ClaimDetail
                        claim={c}
                        statusOptions={['SUBMITTED','IN_REVIEW','MORE_INFO','APPROVED','DENIED','CLOSED']}
                        onStatusChange={updateClaimStatusLocal}
                        onSendMessage={submitClaimMessage}
                        onAddNote={submitClaimNote}
                        onClose={() => toggleClaimDetail(c.id)}
                        closeLabel="Close"
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header fw-semibold">Admin notes (local)</div>
        <div className="card-body">
          <textarea
            className="form-control"
            rows={3}
            placeholder="Add a quick note for this call…"
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
          />
          <div className="text-end mt-2">
            <button className="btn btn-sm btn-primary" onClick={addNote}>Save note</button>
          </div>
          {notes.length === 0 ? (
            <div className="text-muted small">No notes yet.</div>
          ) : (
            <ul className="list-unstyled small mb-0 mt-2">
              {notes.map((n, i) => (
                <li key={i} className="border-top py-2">
                  <div>{n.text}</div>
                  <div className="text-muted">{formatDate(n.createdAt)} {n.createdAt ? new Date(n.createdAt).toLocaleTimeString() : ''}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
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
                <div className="modal-body small">
                  {historyLoading && <div className="py-4 text-center">Loading history…</div>}
                  {!historyLoading && historyError && (
                    <div className="alert alert-danger">{historyError?.message || 'Unable to load history.'}</div>
                  )}
                  {!historyLoading && !historyError && historyData && (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle small" style={{ fontSize: '0.85rem' }}>
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
                            historyData.events.map(evt => {
                              const roleRaw = (evt.actor_role || '').toUpperCase();
                              const role = roleRaw === 'LEADER' ? 'Leader'
                                : roleRaw === 'ADMIN' ? 'Admin'
                                : (evt.actor_role || evt.actor_id || '—');
                              return (
                                <tr key={evt.event_id || evt.timestamp}>
                                  <td>{evt.timestamp ? new Date(evt.timestamp).toLocaleString() : '—'}</td>
                                  <td>{evt.type || '—'}</td>
                                  <td>{role}</td>
                                  <td>{evt.notes || ''}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
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
