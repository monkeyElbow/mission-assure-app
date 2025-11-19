import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../data/api'
import { daysInclusive } from '../core/pricing'
import { listRates, createRate, seedRatesIfEmpty } from '../core/rates'
import { toCSV, download } from '../core/csv'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeSlide } from '../ui/motion'
import InlineNotice from '../components/InlineNotice.jsx'
import { listClaims, updateClaim, addClaimNote, addClaimMessage, markClaimSeen } from '../core/claims'


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
  const [demoLoading, setDemoLoading] = useState(false)

  // ---- Rates state ----
  const [rates, setRates] = useState([])
  const [form, setForm] = useState({ region:'DOMESTIC', amount:'1.25', effectiveStart:'', notes:'' })
  const [ratesExpanded, setRatesExpanded] = useState(false)
  const [showAddRate, setShowAddRate] = useState(false)

  // ---- Claims state ----
  const [claims, setClaims] = useState([])
  const [claimFilter, setClaimFilter] = useState('ALL') // ALL | status
  const [claimSearch, setClaimSearch] = useState('')
  const [activeClaim, setActiveClaim] = useState(null)
  const [claimNote, setClaimNote] = useState('')
  const [showClaimDetail, setShowClaimDetail] = useState(false)
  const [claimsOnlyTrips, setClaimsOnlyTrips] = useState(false)
  const claimsSectionRef = useRef(null)
  const [claimNoteDrafts, setClaimNoteDrafts] = useState({})
  const [claimMsgDrafts, setClaimMsgDrafts] = useState({})
  const [drawerClaimId, setDrawerClaimId] = useState(null)
  const [drawerTripId, setDrawerTripId] = useState(null)
  const [drawerMode, setDrawerMode] = useState(null) // 'claims' | 'members'
  const [drawerMembers, setDrawerMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersIndex, setMembersIndex] = useState({}) // tripId -> minimal member info for search
  const [drawerCoveredIds, setDrawerCoveredIds] = useState(new Set())
  const [sortField, setSortField] = useState('date') // date | claims | trip | members | payment | status
  const [sortDir, setSortDir] = useState('desc') // asc | desc
const formatUsd = (cents = 0) => `$${(Number(cents || 0) / 100).toFixed(2)}`

  // member helpers (mirrors TripDetail logic lightly)
  const getFlag = (obj, ...keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v === true || v === 'true' || v === 1) return true;
      if (v === false || v === 'false' || v === 0) return false;
    }
    return null;
  };

  const getMemberId = (m) => {
    const raw = m?.id ?? m?.member_id ?? m?.memberId;
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  };

  const isEligibleMember = (m) => {
    const isMinor   = getFlag(m, 'is_minor', 'minor', 'isMinor', 'member.isMinor');
    const confirmed = getFlag(m, 'confirmed', 'is_confirmed', 'member.confirmed');
    const guardian  = getFlag(m, 'guardian_approved', 'guardianApproved', 'member.guardianApproved');
    return isMinor ? guardian : confirmed;
  };

  const memberStatus = (m, coveredSet = new Set()) => {
    const coveredFlag = m.covered;
    const coverageDate = m.coverage_as_of;
    const active = m.active;
    const id = getMemberId(m);
    if (active === false) return { label: 'Standby', className: 'badge text-bg-secondary' };
    if (coveredSet.has(id) || coveredFlag === true || coveredFlag === 1 || coveredFlag === 'true' || coverageDate) {
      return { label: 'Paid & Covered', className: 'badge text-bg-success' };
    }
    if (isEligibleMember(m)) {
      // Confirmed but not paid/covered yet
      return { label: 'Confirmed (unpaid)', className: 'badge text-bg-info' };
    }
    return { label: 'Needs Confirmation', className: 'badge text-bg-warning text-dark' };
  };

  // load trips + counts
  useEffect(()=>{
    (async()=>{
      const ts = await api.listTrips()
      setTrips(ts)
      const counts = {}
      const memberMap = {}
      await Promise.all(ts.map(async t=>{
        const { members } = await api.getTrip(t.id)
        counts[t.id] = members.length
        memberMap[t.id] = members.map(m => ({
          name: `${m.firstName || m.first_name || ''} ${m.lastName || m.last_name || ''}`.trim(),
          email: m.email || '',
          phone: m.phone || ''
        }))
      }))
      setMembersByTrip(counts)
      setMembersIndex(memberMap)
    })()
  },[])

  // rates init
useEffect(()=>{
  seedRatesIfEmpty()
  setRates(listRates())
},[])

  // claims init
  useEffect(()=>{
    setClaims(listClaims())
  },[])

  // keep active claim fresh if list changes
  useEffect(()=>{
    if (!activeClaim) return;
    const fresh = listClaims().find(c => c.id === activeClaim.id);
    if (fresh) setActiveClaim(fresh);
    else {
      setActiveClaim(null);
      setShowClaimDetail(false);
    }
  }, [claims]);

  const openClaimStatuses = new Set(['SUBMITTED','IN_REVIEW','MORE_INFO']);
  const claimsByTrip = useMemo(() => {
    const map = new Map();
    claims.forEach(c => {
      const entry = map.get(c.tripId) || { total:0, open:0 };
      entry.total += 1;
      if (openClaimStatuses.has(c.status)) entry.open += 1;
      map.set(c.tripId, entry);
    });
    return map;
  }, [claims, openClaimStatuses]);

  const activeRates = useMemo(() => {
    const latestByRegion = new Map()
    for (const rate of rates) {
      if (!latestByRegion.has(rate.region)) {
        latestByRegion.set(rate.region, rate)
      }
    }
    return Array.from(latestByRegion.values())
  }, [rates])

  const historicalRates = useMemo(() => {
    const activeIds = new Set(activeRates.map(r => r.id))
    return rates.filter(r => !activeIds.has(r.id))
  }, [rates, activeRates])

  const counts = useMemo(()=>{
    const c = { ACTIVE:0, ARCHIVED:0, ALL: trips.length }
    trips.forEach(t => { c[t.status==='ARCHIVED' ? 'ARCHIVED' : 'ACTIVE']++ })
    return c
  }, [trips])

  const filteredTrips = useMemo(()=>{
    let rows = trips
    if (scope === 'ACTIVE') rows = rows.filter(t=>t.status!=='ARCHIVED')
    if (scope === 'ARCHIVED') rows = rows.filter(t=>t.status==='ARCHIVED')
    if (claimsOnlyTrips) rows = rows.filter(t => (claimsByTrip.get(t.id)?.open || 0) > 0)
    if (q.trim()) {
      const s = q.toLowerCase()
      rows = rows.filter(t => {
        const titleMatch = (t.title||'').toLowerCase().includes(s) || (t.shortId||'').toLowerCase().includes(s)
        const members = membersIndex[t.id] || []
        const memberMatch = members.some(m => {
          const hay = `${m.name} ${m.email} ${m.phone}`.toLowerCase()
          return hay.includes(s)
        })
        return titleMatch || memberMatch
      })
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    const statusRank = { ACTIVE: 1, ARCHIVED: 2 };
    const paymentRank = { PAID: 1, PARTIAL: 2, UNPAID: 3, PENDING: 4 };

    const sorted = [...rows].sort((a,b)=>{
      const aClaims = claimsByTrip.get(a.id)?.open || 0;
      const bClaims = claimsByTrip.get(b.id)?.open || 0;
      const aMembers = membersByTrip[a.id] || 0;
      const bMembers = membersByTrip[b.id] || 0;
      const aStart = a.startDate || a.createdAt || '';
      const bStart = b.startDate || b.createdAt || '';

      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = (aStart || '').localeCompare(bStart || '');
          break;
        case 'trip':
          cmp = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity:'base' });
          break;
        case 'members':
          cmp = aMembers - bMembers;
          break;
        case 'payment':
          cmp = (paymentRank[a.paymentStatus] || 99) - (paymentRank[b.paymentStatus] || 99);
          break;
        case 'status':
          cmp = (statusRank[a.status] || 99) - (statusRank[b.status] || 99);
          break;
        case 'claims':
        default:
          cmp = (aClaims - bClaims);
          break;
      }

      if (cmp === 0) {
        // fallback: open claims desc, then start date desc, then createdAt desc
        const claimDiff = bClaims - aClaims;
        if (claimDiff !== 0) cmp = claimDiff;
        else if (aStart && bStart) cmp = bStart.localeCompare(aStart);
        else cmp = (b.createdAt || '').localeCompare(a.createdAt || '');
      }

      return dir * cmp;
    })

    return sorted
  }, [trips, scope, q, claimsOnlyTrips, claimsByTrip, sortField, sortDir, membersByTrip, membersIndex])

  function toggleSort(field){
    setSortDir(prevDir => {
      if (sortField === field) {
        return prevDir === 'asc' ? 'desc' : 'asc';
      }
      return 'asc';
    });
    setSortField(field);
  }

  const sortArrow = (field) => {
    const active = sortField === field || (field === 'trip' && sortField === 'date');
    if (!active) return '';
    return sortDir === 'asc' ? '▲' : '▼';
  };

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

  async function populateDemo(){
    setErr(''); setMsg('');
    try {
      setDemoLoading(true);
      const res = await api.populateDemoContent?.();
      const ts = await api.listTrips();
      setTrips(ts);
      const counts = {};
      await Promise.all(ts.map(async t=>{
        const { members } = await api.getTrip(t.id);
        counts[t.id] = members.length;
      }));
      setMembersByTrip(counts);
      const added = Number(res?.added || 0);
      setMsg(added > 0 ? `Added ${added} demo trip${added === 1 ? '' : 's'}.` : 'Demo data already loaded.');
      setTimeout(()=>setMsg(''), 2500);
    } catch (e) {
      console.error(e);
      setErr(e?.message || 'Unable to populate demo content.');
    } finally {
      setDemoLoading(false);
    }
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
      const role = (evt.actor_role || '').toUpperCase() === 'LEADER' ? 'Leader'
        : (evt.actor_role || '').toUpperCase() === 'ADMIN' ? 'Admin'
        : (evt.actor_role || evt.actor_id || '—');
      return `<tr><td>${ts}</td><td>${evt.type || ''}</td><td>${role}</td><td>${evt.notes || ''}</td></tr>`
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

  const filteredClaims = useMemo(() => {
    const term = claimSearch.trim().toLowerCase();
    return claims
      .filter(c => claimFilter === 'ALL' || c.status === claimFilter)
      .filter(c => {
        if (!term) return true;
        const hay = [
          c.claimNumber, c.tripTitle, c.tripId, c.memberName, c.memberEmail,
          c.reporterName, c.reporterEmail, c.status, c.incidentType, c.incidentLocation
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(term);
      });
  }, [claims, claimFilter, claimSearch]);

  const claimStatusOptions = ['SUBMITTED','IN_REVIEW','MORE_INFO','APPROVED','DENIED','CLOSED'];

  function refreshClaims(){ setClaims(listClaims()); }

  async function updateClaimStatus(id, status){
    try {
      const saved = await updateClaim(id, { status });
      setClaims(listClaims());
      if (activeClaim && activeClaim.id === id) setActiveClaim(saved);
      setMsg(`Updated claim ${saved.claimNumber} to ${status.replace('_',' ')}`);
      setTimeout(()=>setMsg(''), 2500);
    } catch (e) {
      setErr(e?.message || 'Unable to update claim.');
      setTimeout(()=>setErr(''), 4000);
    }
  }

  async function submitClaimNote(id){
    const text = claimNote.trim();
    if (!text) return;
    try {
      const saved = await addClaimNote(id, 'Admin', text);
      setClaims(listClaims());
      setActiveClaim(saved);
      setClaimNote('');
    } catch (e) {
      setErr(e?.message || 'Unable to add note.');
      setTimeout(()=>setErr(''), 4000);
    }
  }

  function openClaimDetail(claim){
    setActiveClaim(claim);
    setShowClaimDetail(true);
    markClaimSeen(claim.id, 'ADMIN');
    refreshClaims();
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 0);
  }

  function closeClaimDetail(){
    setShowClaimDetail(false);
    setActiveClaim(null);
    setClaimNote('');
  }

  const openClaimsForTrip = useMemo(() => {
    const counts = new Map();
    claims.forEach(c => {
      const entry = counts.get(c.tripId) || { total:0, open:0 };
      entry.total += 1;
      if (openClaimStatuses.has(c.status)) entry.open += 1;
      counts.set(c.tripId, entry);
    });
    return counts;
  }, [claims, openClaimStatuses]);

  const totalOpenClaims = useMemo(
    () => Array.from(openClaimsForTrip.values()).reduce((sum, c) => sum + (c.open || 0), 0),
    [openClaimsForTrip]
  );

  const claimsForTrip = (tripId) => claims.filter(c => c.tripId === tripId);

  async function loadMembersForTrip(tripId){
    setMembersLoading(true);
    try{
      const res = await api.getTrip(tripId);
      const members = res?.members || [];
      setDrawerMembers(members);
      setMembersIndex(idx => ({
        ...idx,
        [tripId]: members.map(m => ({
          name: `${m.firstName || m.first_name || ''} ${m.lastName || m.last_name || ''}`.trim(),
          email: m.email || '',
          phone: m.phone || ''
        }))
      }));
      // also grab coverage info to tag paid/covered
      const summary = await api.getRosterSummary(tripId);
      const readyIds = new Set((summary?.ready_roster || []).map(m => m.member_id ?? m.id));
      setDrawerCoveredIds(readyIds);
    } catch (err){
      console.error('Unable to load members', err);
      setDrawerMembers([]);
      setDrawerCoveredIds(new Set());
    } finally {
      setMembersLoading(false);
    }
  }

  function toggleTripClaimsDrawer(tripId) {
    setDrawerMembers([]);
    setDrawerCoveredIds(new Set());
    setMembersLoading(false);
    setShowClaimDetail(false);
    setActiveClaim(null);
    setClaimNote('');
    setClaimNoteDrafts({});
    setDrawerClaimId(null);
    setDrawerTripId(prev => {
      const closing = prev === tripId && drawerMode === 'claims';
      if (closing) {
        setDrawerMode(null);
        return null;
      }
      setDrawerMode('claims');
      const tripClaims = claimsForTrip(tripId);
      if (tripClaims.length) {
        const firstId = tripClaims[0].id;
        setDrawerClaimId(firstId);
        tripClaims.forEach(c => markClaimSeen(c.id, 'ADMIN'));
        refreshClaims();
      } else {
        setDrawerClaimId(null);
      }
      return tripId;
    });
    setTimeout(() => claimsSectionRef.current?.scrollIntoView({ behavior:'smooth' }), 0);
  }

  function toggleTripMembersDrawer(tripId){
    setShowClaimDetail(false);
    setActiveClaim(null);
    setClaimNote('');
    setClaimNoteDrafts({});
    setDrawerClaimId(null);
    setDrawerMembers([]);
    setDrawerCoveredIds(new Set());
    setDrawerTripId(prev => {
      const closing = prev === tripId && drawerMode === 'members';
      if (closing) {
        setDrawerMode(null);
        setDrawerMembers([]);
        setDrawerCoveredIds(new Set());
        return null;
      }
      setDrawerMode('members');
      loadMembersForTrip(tripId);
      return tripId;
    });
    setTimeout(() => claimsSectionRef.current?.scrollIntoView({ behavior:'smooth' }), 0);
  }

  async function submitInlineNote(claimId){
    const text = (claimNoteDrafts[claimId] || '').trim();
    if (!text) return;
    try{
      const saved = await addClaimNote(claimId, 'Admin', text, { actorRole:'ADMIN' });
      setClaims(listClaims());
      if (activeClaim && activeClaim.id === claimId) setActiveClaim(saved);
      setClaimNoteDrafts(d => ({ ...d, [claimId]: '' }));
    }catch(e){
      setErr(e?.message || 'Unable to add note.');
      setTimeout(()=>setErr(''), 4000);
    }
  }

  async function submitInlineMessage(claimId){
    const text = (claimMsgDrafts[claimId] || '').trim();
    if (!text) return;
    try{
      const saved = await addClaimMessage(claimId, { authorRole:'ADMIN', authorName:'Admin', text });
      setClaims(listClaims());
      if (activeClaim && activeClaim.id === claimId) setActiveClaim(saved);
      setClaimMsgDrafts(d => ({ ...d, [claimId]: '' }));
    }catch(e){
      setErr(e?.message || 'Unable to send message.');
      setTimeout(()=>setErr(''), 4000);
    }
  }

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
      setForm({ region:'DOMESTIC', amount:'1.25', effectiveStart:'', notes:'' })
      setShowAddRate(false)
      setTimeout(()=>setMsg(''), 2500)
    }catch(ex){ setErr(ex.message || 'Failed to add rate') }
  }

  return (
    <div className="container my-3" style={{maxWidth: 1100}}>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h1 className="h3 mb-0">Howdy, Admin</h1>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={populateDemo}
          disabled={demoLoading}
          title="Add sample trips and travelers"
        >
          {demoLoading ? 'Loading…' : 'Populate demo content'}
        </button>
      </div>
      {err && (
        <InlineNotice tone="danger" dismissible timeoutMs={6000} className="mb-2">
          {err}
        </InlineNotice>
      )}
      {msg && (
        <InlineNotice tone="success" dismissible timeoutMs={4000} className="mb-2">
          {msg}
        </InlineNotice>
      )}

      {/* ---- Trips section ---- */}
      <div className="card p-3 mb-4 no-hover">
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
          <h2 className="h5 mb-0">Trips</h2>
          <div className="d-flex flex-column flex-md-row gap-2 align-items-start align-items-md-center w-100" style={{maxWidth: 820}}>
            <div className="flex-grow-1">
              <input
                className="form-control form-control-sm"
                placeholder="Search title or #shortId…"
                style={{minWidth: 220}}
                value={q}
                onChange={e=>setQ(e.target.value)}
              />
            </div>
            <div className="d-flex gap-2 ms-auto">
              <div className="btn-group">
                <button className={`btn btn-sm ${scope==='ACTIVE'?'btn-secondary':'btn-outline-secondary'}`} onClick={()=>setScope('ACTIVE')}>Active ({counts.ACTIVE})</button>
                <button className={`btn btn-sm ${scope==='ARCHIVED'?'btn-secondary':'btn-outline-secondary'}`} onClick={()=>setScope('ARCHIVED')}>Archived ({counts.ARCHIVED})</button>
                <button
                  type="button"
                  className={`btn btn-sm ${claimsOnlyTrips ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={()=>setClaimsOnlyTrips(v=>!v)}
                  title="Show trips with open claims"
                >
                  Show open claims ({totalOpenClaims})
                </button>
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
        </div>

        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0 admin-table">
            <thead>
              <tr>
                <th>
                  <button className="btn btn-link btn-sm p-0 text-decoration-none text-dark" onClick={()=>toggleSort('trip')}>
                    Trip {sortArrow('trip')}
                  </button>
                </th>
                <th>
                  <button className="btn btn-link btn-sm p-0 text-decoration-none text-dark" onClick={()=>toggleSort('members')}>
                    Members {sortArrow('members')}
                  </button>
                </th>
                <th>
                  <button className="btn btn-link btn-sm p-0 text-decoration-none text-dark" onClick={()=>toggleSort('claims')}>
                    Claims {sortArrow('claims')}
                  </button>
                </th>
                <th>
                  <button className="btn btn-link btn-sm p-0 text-decoration-none text-dark" onClick={()=>toggleSort('payment')}>
                    Payment {sortArrow('payment')}
                  </button>
                </th>
                <th>
                  <button className="btn btn-link btn-sm p-0 text-decoration-none text-dark" onClick={()=>toggleSort('status')}>
                    Status {sortArrow('status')}
                  </button>
                </th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
            <AnimatePresence>
              {filteredTrips.map(t=>{
                const days = daysInclusive(t.startDate, t.endDate);
                const isExpanded = drawerTripId === t.id;
                const tripClaims = claimsForTrip(t.id);
                const claimStats = claimsByTrip.get(t.id) || { total:0, open:0 };
                const openCount = claimStats.open || 0;
                const closedCount = Math.max(0, (claimStats.total || 0) - openCount);
                const claimLabel = openCount > 0 ? openCount : closedCount;
                const hasFreshAdmin = tripClaims.some(c => c.freshForAdmin);

                let btnClass = 'btn-outline-secondary';
                let claimColor = '#6c757d';
                let textClass = 'text-muted';
                if (hasFreshAdmin) {
                  btnClass = 'btn-outline-danger';
                  claimColor = '#dc3545'; // red for new activity
                  textClass = 'text-danger';
                } else if (openCount > 0) {
                  btnClass = 'btn-outline-warning';
                  claimColor = '#f0ad4e'; // amber for active
                  textClass = 'text-warning';
                }

                return (
                  <React.Fragment key={t.id}>
                    <motion.tr {...fadeSlide}>
                      <td>
                        <div className="fw-medium">
                          <Link to={`/trips/${t.id}`} className="text-decoration-none">{t.title}</Link>
                          {t.shortId && <span className="text-muted smaller ms-2">#{t.shortId}</span>}
                        </div>
                        <div className="text-muted small d-flex align-items-center gap-2 flex-wrap">
                          <span className="badge text-bg-light small">{t.region}</span>
                          <span>{t.startDate} → {t.endDate} ({days} days)</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => toggleTripMembersDrawer(t.id)}
                          title="View members for this trip"
                        >
                          {membersByTrip[t.id] || 0}
                        </button>
                      </td>
                      <td className="text-center">
                        {(claimStats.total || 0) > 0 && (
                          <button
                            type="button"
                            className={`btn btn-sm claims-count-btn ${btnClass}`}
                            style={{ color: claimColor, borderColor: claimColor }}
                            onClick={() => toggleTripClaimsDrawer(t.id)}
                            title="View claims for this trip"
                          >
                            <span className={textClass}>{claimLabel}</span>
                            {hasFreshAdmin && <span className="claims-fresh-dot ms-2" aria-label="New claim activity"></span>}
                          </button>
                        )}
                      </td>
                      <td>
                        {t.paymentStatus === 'PAID' ? (
                          <span className="badge bg-agf2 text-white">PAID</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm d-inline-flex align-items-center gap-1"
                            style={{ background: '#f26660', color: '#fff', borderColor: '#f26660' }}
                            onClick={()=>{
                              if (window.confirm('You are about to mark this trip paid. Continue?')) {
                                markPaid(t);
                              }
                            }}
                            title="Mark as paid (offline payment override)"
                          >
                            Pay {formatUsd(Number(t.creditsTotalCents || 0) - Number(t.creditsUsedCents || 0))}
                          </button>
                        )}
                      </td>
                      <td>
                        {t.status==='ARCHIVED'
                          ? <span className="badge text-bg-secondary">ARCHIVED</span>
                          : <span className="badge text-bg-primary-subtle" style={{ color: 'var(--agf2)' }}>ACTIVE</span>}
                      </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Link
                          to={`/trips/${t.id}`}
                          className="btn btn-outline-secondary d-flex align-items-center justify-content-center border-end-0"
                          style={{ borderRightWidth: 0 }}
                        >
                          Open
                        </Link>
                        <button
                          className="btn btn-outline-secondary d-flex align-items-center justify-content-center border-end-0"
                          style={{ borderRightWidth: 0 }}
                          onClick={()=>viewHistory(t)}
                        >
                          History
                        </button>
                        {t.paymentStatus!=='PAID' && (
                          <button
                            className="btn btn-outline-success d-flex align-items-center justify-content-center border-end-0"
                            style={{ borderRightWidth: 0 }}
                            onClick={()=>markPaid(t)}
                          >
                            Mark Paid
                          </button>
                        )}
                        {t.status==='ARCHIVED' ? (
                          <button
                            className="btn btn-outline-primary d-flex align-items-center justify-content-center border-end-0"
                            style={{ borderRightWidth: 0 }}
                            onClick={()=>unarchive(t)}
                          >
                            Unarchive
                          </button>
                        ) : (
                          <button
                            className="btn btn-outline-secondary d-flex align-items-center justify-content-center border-end-0"
                            style={{ borderRightWidth: 0 }}
                            onClick={()=>archive(t)}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          className="btn btn-outline-danger d-flex align-items-center justify-content-center"
                          onClick={async ()=>{
                            try {
                              await api.deleteTrip(t.id);
                              setTrips(ts => ts.filter(x => x.id !== t.id));
                              setMembersByTrip(m => { const { [t.id]:_, ...rest } = m; return rest; });
                              setMsg(`Deleted trip ${t.title}`);
                              setTimeout(() => setMsg(''), 2000);
                            } catch (err) {
                              console.error(err);
                              setErr(err?.message || 'Failed to delete trip.');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                    </motion.tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6}>
                          <div className="border rounded-3 p-3 bg-light">
                            {drawerMode === 'claims' && (
                              <>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <div className="fw-semibold">Claims for {t.title}</div>
                                  <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleTripClaimsDrawer(t.id)}>Close</button>
                                </div>
                                {tripClaims.length === 0 ? (
                                  <div className="text-muted small">No claims for this trip.</div>
                                ) : (
                                  <>
                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                      {tripClaims.map(c => {
                                        const selected = drawerClaimId === c.id;
                                        return (
                                          <button
                                            key={c.id}
                                            className={`btn btn-sm ${selected ? 'btn-light border-secondary text-dark fw-semibold' : 'btn-outline-secondary text-dark'}`}
                                            onClick={() => { setDrawerClaimId(c.id); markClaimSeen(c.id,'ADMIN'); refreshClaims(); }}
                                          >
                                            {c.claimNumber}
                                            {c.freshForAdmin && <span className="badge bg-danger ms-1">New</span>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {(() => {
                                      const selected = tripClaims.find(c => c.id === drawerClaimId) || tripClaims[0];
                                      if (!selected) return null;
                                      return (
                                        <div className="border rounded-3 p-3 bg-white">
                                          <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                              <div className="fw-semibold">{selected.claimNumber}</div>
                                              <div className="text-muted small">{selected.memberName || 'Traveler'} ({selected.memberEmail || '—'})</div>
                                              <div className="text-muted small">Reporter: {selected.reporterName || '—'} ({selected.reporterEmail || '—'})</div>
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                              <div className="fw-semibold small mb-0">Status</div>
                                              <select
                                                className="form-select form-select-sm"
                                                value={selected.status}
                                                onChange={e => updateClaimStatus(selected.id, e.target.value)}
                                              >
                                                {claimStatusOptions.map(s => (
                                                  <option key={s} value={s}>{s.replace('_',' ')}</option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                          <div className="mt-2 small text-muted">
                                            {selected.incidentType || 'Incident'} {selected.incidentLocation ? `· ${selected.incidentLocation}` : ''} {selected.incidentDate ? `· ${new Date(selected.incidentDate).toLocaleDateString()}` : ''}
                                          </div>
                                          <div className="mt-1">{selected.incidentDescription || 'No description provided.'}</div>
                                          {(selected.attachments || []).length > 0 && (
                                            <div className="mt-2 small">
                                              <strong>Attachments:</strong> {(selected.attachments || []).map(a => a.filename).join(', ')}
                                            </div>
                                          )}
                                          <div className="mt-3">
                                            <div className="fw-semibold small mb-1">Messages</div>
                                            {(selected.messages || []).length === 0 ? (
                                              <div className="text-muted small">No messages yet.</div>
                                            ) : (
                                              <ul className="list-unstyled mb-2 small">
                                                {selected.messages.map(m => (
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
                                                placeholder="Message leader…"
                                                value={claimMsgDrafts[selected.id] || ''}
                                                onChange={e=>setClaimMsgDrafts(d=>({ ...d, [selected.id]: e.target.value }))}
                                              />
                                              <button
                                                className="btn btn-outline-primary btn-sm"
                                                onClick={() => submitInlineMessage(selected.id)}
                                              >
                                                Send
                                              </button>
                                            </div>
                                          </div>

                                          <div className="mt-3">
                                            <div className="fw-semibold small mb-1">Notes</div>
                                            {(selected.notes || []).length === 0 ? (
                                              <div className="text-muted small">No notes yet.</div>
                                            ) : (
                                              <ul className="list-unstyled mb-2 small">
                                                {selected.notes.map(n => (
                                                  <li key={n.id} className="border rounded-3 p-2 mb-2">
                                                    <div className="fw-semibold">{n.author || 'Admin'}</div>
                                                    <div>{n.text}</div>
                                                    <div className="text-muted">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                            <div className="d-flex gap-2">
                                              <input
                                                className="form-control form-control-sm"
                                                placeholder="Add note…"
                                                value={claimNoteDrafts[selected.id] || ''}
                                                onChange={e=>setClaimNoteDrafts(d=>({ ...d, [selected.id]: e.target.value }))}
                                              />
                                              <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => submitInlineNote(selected.id)}
                                              >
                                                Add
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </>
                                )}
                              </>
                            )}

                            {drawerMode === 'members' && (
                              <>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <div className="fw-semibold">Members for {t.title}</div>
                                  <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleTripMembersDrawer(t.id)}>Close</button>
                                </div>
                                {membersLoading ? (
                                  <div className="text-muted small">Loading members…</div>
                                ) : (drawerMembers || []).length === 0 ? (
                                  <div className="text-muted small">No members found.</div>
                                ) : (
                                  <ul className="list-group list-group-flush">
                                    {drawerMembers.map(m => {
                                      const name = `${m.firstName || m.first_name || ''} ${m.lastName || m.last_name || ''}`.trim() || m.email || `Member ${m.id}`;
                                      const status = memberStatus(m, drawerCoveredIds);
                                      return (
                                        <li key={m.id || m.member_id} className="list-group-item">
                                          <div className="fw-semibold">{name}</div>
                                          <div className="text-muted small">{m.email || '—'}</div>
                                          <div className="d-flex align-items-center gap-2 flex-wrap small">
                                            {m.phone && <span className="text-muted">{m.phone}</span>}
                                            <span className={`${status.className} text-uppercase`} style={{ fontWeight: 600 }}>{status.label}</span>
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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

      {/* ---- Claims section ---- */}
      <div className="card p-3 mb-4 no-hover">
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
          <h2 className="h5 mb-0">Claims</h2>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <select
              className="form-select form-select-sm"
              style={{ minWidth: 170 }}
              value={claimFilter}
              onChange={e => setClaimFilter(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              {claimStatusOptions.map(s => (
                <option key={s} value={s}>{s.replace('_',' ')}</option>
              ))}
            </select>
            <input
              className="form-control form-control-sm"
              placeholder="Search claims…"
              style={{ minWidth: 220 }}
              value={claimSearch}
              onChange={e=>setClaimSearch(e.target.value)}
            />
          </div>
        </div>

        {filteredClaims.length === 0 ? (
          <div className="text-muted small">No claims found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style={{width:'18%'}}>Claim #</th>
                  <th style={{width:'24%'}}>Trip</th>
                  <th style={{width:'20%'}}>Traveler</th>
                  <th style={{width:'16%'}}>Status</th>
                  <th style={{width:'14%'}}>Submitted</th>
                  <th style={{width:'8%'}}></th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map(c => (
                  <tr key={c.id} className={activeClaim?.id === c.id ? 'table-active' : ''}>
                    <td className="fw-semibold">{c.claimNumber}</td>
                    <td>
                      <div className="fw-semibold">{c.tripTitle || 'Trip'}</div>
                      <div className="text-muted small">{c.tripId}</div>
                    </td>
                    <td>
                      <div className="fw-semibold">{c.memberName || 'Traveler'}</div>
                      <div className="text-muted small">{c.memberEmail}</div>
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={c.status}
                        onChange={e => updateClaimStatus(c.id, e.target.value)}
                      >
                        {claimStatusOptions.map(s => (
                          <option key={s} value={s}>{s.replace('_',' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-muted small">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => openClaimDetail(c)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showClaimDetail && activeClaim && (
          <div className="admin-claim-overlay">
            <div className="admin-claim-panel">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div className="fw-semibold mb-1">{activeClaim.claimNumber}</div>
                  <div className="text-muted small">{activeClaim.tripTitle || 'Trip'} · {activeClaim.tripId}</div>
                  <div className="text-muted small">
                    Traveler: {activeClaim.memberName || '—'} ({activeClaim.memberEmail || '—'})
                  </div>
                  <div className="text-muted small">
                    Reporter: {activeClaim.reporterName || '—'} ({activeClaim.reporterEmail || '—'})
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={closeClaimDetail}
                >
                  Close
                </button>
              </div>

              <div className="mb-3">
                <label className="form-label small mb-1">Status</label>
                <select
                  className="form-select form-select-sm"
                  value={activeClaim.status}
                  onChange={e => updateClaimStatus(activeClaim.id, e.target.value)}
                >
                  {claimStatusOptions.map(s => (
                    <option key={s} value={s}>{s.replace('_',' ')}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <div className="fw-semibold small mb-1">Incident</div>
                <div className="small text-muted">
                  {activeClaim.incidentType || '—'} {activeClaim.incidentLocation ? `· ${activeClaim.incidentLocation}` : ''}
                </div>
                <div className="small text-muted">
                  {activeClaim.incidentDate ? new Date(activeClaim.incidentDate).toLocaleDateString() : ''}
                </div>
                <div className="mt-2">{activeClaim.incidentDescription || 'No description provided.'}</div>
              </div>

              {(activeClaim.attachments || []).length > 0 && (
                <div className="mb-3">
                  <div className="fw-semibold small mb-1">Attachments</div>
                  <ul className="small mb-0">
                    {activeClaim.attachments.map(a => (
                      <li key={a.id}>{a.filename} ({a.size ? `${(a.size/1024).toFixed(1)} KB` : ''})</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mb-3">
                <div className="fw-semibold small mb-1">Notes</div>
                {(activeClaim.notes || []).length === 0 ? (
                  <div className="text-muted small">No notes yet.</div>
                ) : (
                  <ul className="list-unstyled mb-2 small">
                    {activeClaim.notes.map(n => (
                      <li key={n.id} className="border rounded-3 p-2 mb-2">
                        <div className="fw-semibold">{n.author || 'Admin'}</div>
                        <div>{n.text}</div>
                        <div className="text-muted">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="d-flex gap-2">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Add note…"
                    value={claimNote}
                    onChange={e=>setClaimNote(e.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => submitClaimNote(activeClaim.id)}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* ---- Rates Manager ---- */}
      <div className="card p-3 mb-4 no-hover">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Rates</h2>
          <div className="d-flex gap-2">
            {historicalRates.length > 0 && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setRatesExpanded(v => !v)}
              >
                {ratesExpanded ? 'Hide rate history' : 'View rate history'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddRate(v => !v)}
            >
              {showAddRate ? 'Close rate form' : 'Add new rate'}
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Region</th>
                <th style={{ width: '20%' }}>Amount</th>
                <th style={{ width: '20%' }}>Effective Start</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {activeRates.map(r => (
                <tr key={r.id}>
                  <td><span className="badge bg-agf2 text-white">{r.region}</span></td>
                  <td>${(r.amountCents/100).toFixed(2)}</td>
                  <td>{r.effectiveStart}</td>
                  <td className="text-muted">{r.notes || 'Current rate'}</td>
                </tr>
              ))}
              {activeRates.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">No rates configured yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showAddRate && (
          <form className="row g-3 mt-3 border-top pt-3" onSubmit={addRate}>
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
            <div className="col-12 d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAddRate(false)}>
                Cancel
              </button>
              <button className="btn btn-primary">Save rate</button>
            </div>
          </form>
        )}

        {ratesExpanded && historicalRates.length > 0 && (
          <div className="table-responsive mt-3">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Region</th>
                  <th style={{ width: '20%' }}>Amount</th>
                  <th style={{ width: '20%' }}>Effective Start</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {historicalRates.map(r => (
                  <tr key={r.id}>
                    <td>{r.region}</td>
                    <td>${(r.amountCents/100).toFixed(2)}</td>
                    <td>{r.effectiveStart}</td>
                    <td className="text-muted">{r.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                <div className="modal-body small">
                  {historyLoading && <div className="py-4 text-center">Loading history…</div>}
                  {!historyLoading && historyError && (
                    <div className="alert alert-danger">{historyError?.message || 'Unable to load history.'}</div>
                  )}
                  {!historyLoading && !historyError && historyData && historyTrip && (
                    <>
                      <div className="mb-3 small text-muted">
                        <div><strong>Trip:</strong> {historyTrip.title || 'Trip'} ({historyTrip.shortId || historyTrip.id})</div>
                        <div><strong>Dates:</strong> {historyTrip.startDate || '—'} &rarr; {historyTrip.endDate || '—'}</div>
                        <div><strong>Region:</strong> {historyTrip.region || '—'}</div>
                        <div><strong>Status:</strong> {historyTrip.status || '—'}</div>
                      </div>
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
