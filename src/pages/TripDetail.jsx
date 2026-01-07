import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../data/api.local.js'
import TripMembersList from '../components/trip/TripMembersList.jsx'
import TripMemberAddForm from '../components/trip/TripMemberAddForm.jsx'
import { p } from 'framer-motion/client'
import { listPayments } from '../core/ledger.js'
import ClaimQuickModal from '../components/trip/ClaimQuickModal.jsx'
import { listClaims } from '../core/claims.js'
import MemberConfirmModal from '../components/trip/MemberConfirmModal.jsx'
import GuardianApprovalModal from '../components/trip/GuardianApprovalModal.jsx'
import { buildReceiptSnapshot, renderReceiptHTML } from '../core/receipt.js'
import { useTour } from '../core/TourContext.jsx'
import TourCallout from '../components/tour/TourCallout.jsx'
import InlineNotice from '../components/InlineNotice.jsx'


// === helpers (module scope) ===
// robust truthy
const asBool = (v) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on';
  }
  return Boolean(v);
};

// get nested or flat value, supports "a.b"
const getVal = (obj, ...keys) => {
  for (const k of keys) {
    const parts = String(k).split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else { cur = undefined; break; }
    }
    if (cur !== undefined) return cur;
  }
  return undefined;
};

const getFlag = (obj, ...keys) => asBool(getVal(obj, ...keys));

// Try to extract a memberId from a summary row
const getLooseMemberId = (m) => {
  const raw = getVal(m, 'id', 'member_id', 'memberId', 'member.id');
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw ?? null;
};

// NEW: Given a tripId and a summary row, find the canonical member record + id
async function resolveCanonicalMemberId(api, tripId, summaryMember) {
  // First guess from the row
  const guess = getLooseMemberId(summaryMember);

  // Pull canonical list (api.listMembers already exists in your local API)
  const all = await api.listMembers(tripId); // returns full member objects

  // 1) direct id match
  if (guess != null) {
    const hit = all.find(m => String(m.id) === String(guess));
    if (hit) return hit.id;
  }

  // 2) match on member_id if present in canonical list (defensive)
  if (guess != null) {
    const hit = all.find(m => String(m.member_id) === String(guess));
    if (hit) return hit.id;
  }

  // 3) match by strong identity: email (case-insensitive)
  const email = (getVal(summaryMember, 'email') || '').trim().toLowerCase();
  if (email) {
    const hit = all.find(m => (m.email || '').trim().toLowerCase() === email);
    if (hit) return hit.id;
  }

  // 4) weaker match: first+last+phone
  const fn = (getVal(summaryMember, 'first_name') || '').trim().toLowerCase();
  const ln = (getVal(summaryMember, 'last_name')  || '').trim().toLowerCase();
  const ph = (getVal(summaryMember, 'phone')      || '').replace(/\D+/g,'');
  if (fn || ln) {
    const hit = all.find(m =>
      ((m.first_name || '').trim().toLowerCase() === fn) &&
      ((m.last_name  || '').trim().toLowerCase() === ln) &&
      (!ph || (String(m.phone || '').replace(/\D+/g,'') === ph))
    );
    if (hit) return hit.id;
  }

  // If we get here, we really don’t know. Return the guess; API will error and you’ll see which one.
  return guess;
}


// Member id can be id, member_id, or memberId; coerce numeric if possible
const getMemberId = (m) => {
  const raw = m?.id ?? m?.member_id ?? m?.memberId;
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw; // try number, else pass-through
};

// Same eligibility rule as backend (adults need confirmed; minors need guardian)
const isEligibleMember = (m) => {
  const isMinor   = getFlag(m, 'is_minor', 'minor', 'isMinor', 'member.isMinor');
  const confirmed = getFlag(m, 'confirmed', 'is_confirmed', 'member.confirmed');
  const guardian  = getFlag(m, 'guardian_approved', 'guardianApproved', 'member.guardianApproved');
  return isMinor ? guardian : confirmed;
};



function MemberRow({
  tripId,
  member,
  status,                 // 'ready' | 'pending'
  canAllocate,
  canRelease,
  onAllocate,             // () => void
  onRelease,              // () => void
  onAfterSave,            // () => Promise<void> (refresh data)
  onRequestConfirm,
  onRequestGuardian,
}) {
  const {
    member_id,
    first_name,
    last_name,
    email,
    phone,
    color_key
  } = member;

  // Build a fully-populated draft from the latest member data
  function buildDraftFromMember(m) {
    const g = m?.guardian || {};
    const pick = (o, ...ks) => {
      for (const k of ks) if (o?.[k] != null && o[k] !== "") return o[k];
      return "";
    };
  
    return {
      first_name: m.first_name || "",
      last_name:  m.last_name  || "",
      email:      m.email      || "",
      phone:      m.phone      || "",
      active: (m.active !== false),
  
      isMinor:            getFlag(m, 'is_minor','minor','isMinor','member.isMinor'),
      confirmed:          getFlag(m, 'confirmed','is_confirmed','member.confirmed'),
      guardianApproved:   getFlag(m, 'guardian_approved','guardianApproved','guardian.approved','member.guardianApproved'),
  
      // try nested guardian, then flat legacy, then camelCase variants
      guardian_first_name: pick(g, 'first_name') || pick(m, 'guardian_first_name','guardianFirst','guardian_first'),
      guardian_last_name:  pick(g, 'last_name')  || pick(m, 'guardian_last_name','guardianLast','guardian_last'),
      guardian_email:      pick(g, 'email')      || pick(m, 'guardian_email','guardianEmail'),
      guardian_phone:      pick(g, 'phone')      || pick(m, 'guardian_phone','guardianPhone')
    };
  }
  
  

  // --- view-mode badges (truthy-safe)
const isMinorLocal = getFlag(member, 'is_minor','minor','isMinor','member.isMinor');
const confirmedOk  = getFlag(member, 'confirmed','is_confirmed','member.confirmed');
const guardianOk   = getFlag(member, 'guardian_approved','guardianApproved','member.guardianApproved');
const [showGuardianDemo, setShowGuardianDemo] = useState(false);


  // --- inline edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);


// --- inside MemberRow initial state:
const guardianObj = member.guardian || {};
const [draft, setDraft] = useState(() => buildDraftFromMember(member));
useEffect(() => { if (editing) setDraft(buildDraftFromMember(member)); }, [member, editing]);

// --- refresh on entering edit:
function startEdit() {
  const g = member.guardian || {};
  setDraft(buildDraftFromMember(member));
  setEditing(true);
}


  function cancelEdit() { setEditing(false); }

  async function saveEdit() {
    try {
      setSaving(true);
  
      // Build guardian object + payload (keep your version or this one)
      const guardian = {
        first_name: draft.guardian_first_name?.trim() || "",
        last_name:  draft.guardian_last_name?.trim()  || "",
        email:      draft.guardian_email?.trim()      || "",
        phone:      draft.guardian_phone?.trim()      || "",
        approved:   !!draft.guardianApproved,
        approved_at: draft.guardianApproved ? new Date().toISOString() : null
      };
  
      const payload = {
        first_name: draft.first_name.trim(),
        last_name:  draft.last_name.trim(),
        email:      draft.email.trim(),
        phone:      draft.phone.trim(),
        active: !!draft.active,
        isMinor: !!draft.isMinor,
        is_minor: !!draft.isMinor,
        confirmed:           !draft.isMinor ? !!draft.confirmed : false,
        guardianApproved:     draft.isMinor ? !!draft.guardianApproved : false,
        guardian_approved:    draft.isMinor ? !!draft.guardianApproved : false,
        guardian
      };
  
      // === Resolve the canonical ID from the authoritative list ===
      const all = await api.listMembers(tripId);          // canonical members
      const guess = String(
        member?.id ?? member?.member_id ?? member?.memberId ?? ""
      );
  
      // try: direct id
      let hit = all.find(m => String(m.id) === guess);
  
      // try: member_id in canonical list
      if (!hit && guess) hit = all.find(m => String(m.member_id) === guess);
  
      // try: email (case-insensitive)
      if (!hit && member?.email)
        hit = all.find(m => (m.email || "").toLowerCase() === (member.email || "").toLowerCase());
  
      // try: name + phone
      if (!hit) {
        const fn = (member.first_name || "").trim().toLowerCase();
        const ln = (member.last_name  || "").trim().toLowerCase();
        const ph = (member.phone || "").replace(/\D+/g, "");
        hit = all.find(m =>
          (m.first_name || "").trim().toLowerCase() === fn &&
          (m.last_name  || "").trim().toLowerCase() === ln &&
          (!ph || (String(m.phone || "").replace(/\D+/g, "") === ph))
        );
      }
  
      if (!hit) throw new Error("Member not found (couldn't resolve canonical id)");
  
      // === Update using the canonical id ===
      await api.updateMember(hit.id, payload);
  
      if (onAfterSave) await onAfterSave();
      setEditing(false);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }




  const memberId = member.member_id ?? member.id ?? member.memberId;
  const statusLabel = isMinorLocal
    ? (guardianOk ? 'Guardian OK' : 'Guardian needed')
    : (confirmedOk ? 'Confirmed' : 'Unconfirmed');
  const statusBadgeClass = (isMinorLocal ? guardianOk : confirmedOk)
    ? 'bg-agf2 text-white'
    : 'bg-melon';
  const statusTip = isMinorLocal
    ? (guardianOk ? 'Click to revoke guardian approval' : 'Click to simulate guardian approval')
    : (confirmedOk ? 'Click to mark unconfirmed' : 'Click to confirm traveler');

  async function handleStatusBadgeClick() {
    if (statusUpdating) return;
    if (isMinorLocal) {
      if (guardianOk) {
        setStatusUpdating(true);
        try {
          const guardianPayload = {
            guardianApproved: false,
            guardian_approved: false,
            guardianApprovedAt: null,
            guardian_approved_at: null,
            guardian: {
              first_name: member.guardian_first_name ?? member.guardianFirst ?? member.guardian?.first_name ?? '',
              last_name: member.guardian_last_name ?? member.guardianLast ?? member.guardian?.last_name ?? '',
              email: member.guardian_email ?? member.guardianEmail ?? member.guardian?.email ?? '',
              phone: member.guardian_phone ?? member.guardianPhone ?? member.guardian?.phone ?? '',
              approved: false,
              approved_at: null
            }
          };
          await api.updateMember(memberId, guardianPayload);
          if (status === 'ready') {
            try {
              await api.releaseCoverage(tripId, memberId, { reason: 'Guardian approval revoked' });
            } catch (releaseErr) {
              console.warn('Unable to release coverage while revoking guardian approval', releaseErr);
            }
          }
          await onAfterSave?.();
        } catch (err) {
          console.error(err);
          alert(err?.message || 'Unable to update guardian approval.');
        } finally {
          setStatusUpdating(false);
        }
      } else {
        await onRequestGuardian?.(member);
      }
    } else {
      if (confirmedOk) {
        setStatusUpdating(true);
        try {
          await api.updateMember(memberId, {
            confirmed: false,
            confirmedAt: null,
            confirmed_at: null,
            is_confirmed: false
          });
          if (status === 'ready') {
            try {
              await api.releaseCoverage(tripId, memberId, { reason: 'Traveler unconfirmed' });
            } catch (releaseErr) {
              console.warn('Unable to release coverage while toggling confirmation', releaseErr);
            }
          }
          await onAfterSave?.();
        } catch (err) {
          console.error(err);
          alert(err?.message || 'Unable to update confirmation.');
        } finally {
          setStatusUpdating(false);
        }
      } else {
        await onRequestConfirm?.(member);
      }
    }
  }

  function handleStatusBadgeKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleStatusBadgeClick();
    }
  }


  // --- UI
  const fullName =
  (`${member.firstName || member.first_name || ''} ${member.lastName || member.last_name || ''}`.trim()) ||
  member.name ||
  member.fullName ||
  '(Name unavailable)';

  return (
    <div className="d-flex align-items-start justify-content-between py-2" role="listitem">
      <div className="d-flex align-items-start gap-2 flex-grow-1">
        {/* color dot */}
        <span
          style={{ width:10, height:10, borderRadius:50, background: color_key || '#adb5bd', marginTop: 8 }}
          aria-hidden="true"
        />
        {/* LEFT: content */}
        <div className="flex-grow-1">
          {!editing ? (
            <>
              <div className="fw-semibold">{fullName}</div>
              <div className="d-flex flex-wrap gap-1 mt-1">
                <span className="badge text-bg-light">{isMinorLocal ? 'Minor' : 'Adult'}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className={`badge ${statusBadgeClass}`}
                  onClick={handleStatusBadgeClick}
                  onKeyDown={handleStatusBadgeKey}
                  title={statusTip}
                  style={{ cursor: statusUpdating ? 'not-allowed' : 'pointer', opacity: statusUpdating ? 0.7 : 1 }}
                >
                  {statusLabel}
                </span>
                {status === 'ready'   && <span className="badge bg-agf1 text-white">Covered</span>}
              </div>
              <div className="small text-muted mt-1">
                {email || '—'}{(email && phone) ? ' • ' : ''}{phone || ''}
              </div>
            </>
          ) : (
            // EDIT MODE (inline)
            <div className="row g-2">
              <div className="col-6">
                <input className="form-control" placeholder="First name"
                  value={draft.first_name}
                  onChange={e=>setDraft(d=>({...d, first_name:e.target.value}))}/>
              </div>
              <div className="col-6">
                <input className="form-control" placeholder="Last name"
                  value={draft.last_name}
                  onChange={e=>setDraft(d=>({...d, last_name:e.target.value}))}/>
              </div>
              <div className="col-12">
                <input type="email" className="form-control" placeholder="Email"
                  value={draft.email}
                  onChange={e=>setDraft(d=>({...d, email:e.target.value}))}/>
              </div>
              <div className="col-12">
                <input className="form-control" placeholder="Phone"
                  value={draft.phone}
                  onChange={e=>setDraft(d=>({...d, phone:e.target.value}))}/>
              </div>
              <div className="col-12 d-flex flex-wrap gap-3 mt-1 align-items-center">
  <label className="form-check">
    <input className="form-check-input" type="checkbox"
      checked={!!draft.isMinor}
      onChange={e => setDraft(d => ({...d, isMinor: e.target.checked}))}/>
    <span className="form-check-label ms-1">Minor</span>
  </label>

  {!draft.isMinor ? (
    <label className="form-check">
      <input className="form-check-input" type="checkbox"
        checked={!!draft.confirmed}
        onChange={e => setDraft(d => ({...d, confirmed: e.target.checked}))}/>
      <span className="form-check-label ms-1">Confirmed (adult)</span>
    </label>
  ) : (
    <label className="form-check">
      <input className="form-check-input" type="checkbox"
        checked={!!draft.guardianApproved}
        onChange={e => setDraft(d => ({...d, guardianApproved: e.target.checked}))}/>
      <span className="form-check-label ms-1">Guardian Approved (minor)</span>
    </label>
  )}

  <label className="form-check">
    <input className="form-check-input" type="checkbox"
      checked={!!draft.active}
      onChange={e => setDraft(d => ({...d, active: e.target.checked}))}/>
    <span className="form-check-label ms-1">Active</span>
  </label>
</div>
{/* Minor-only guardian section */}
{draft.isMinor && (
  <div className="col-12 mt-2">
    <div className="fw-semibold mb-1">Guardian Information</div>
    <div className="row g-2">
      <div className="col-6">
        <input className="form-control" placeholder="Guardian first name"
          value={draft.guardian_first_name}
          onChange={e=>setDraft(d=>({...d, guardian_first_name:e.target.value}))}/>
      </div>
      <div className="col-6">
        <input className="form-control" placeholder="Guardian last name"
          value={draft.guardian_last_name}
          onChange={e=>setDraft(d=>({...d, guardian_last_name:e.target.value}))}/>
      </div>
      <div className="col-12">
        <input type="email" className="form-control" placeholder="Guardian email"
          value={draft.guardian_email}
          onChange={e=>setDraft(d=>({...d, guardian_email:e.target.value}))}/>
      </div>
      <div className="col-12">
        <input className="form-control" placeholder="Guardian phone"
          value={draft.guardian_phone}
          onChange={e=>setDraft(d=>({...d, guardian_phone:e.target.value}))}/>
      </div>
    </div>

    {/* Demo approval controls */}
    <div className="d-flex flex-wrap gap-2 mt-2">
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        onClick={() => setShowGuardianDemo(true)}
      >
        Send approval request (demo)
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline-success"
        onClick={() => setDraft(d => ({ ...d, guardianApproved: true }))}
        title="Simulate guardian clicking approval in email"
      >
        Mark Approved (demo)
      </button>
      <span className={`badge ${draft.guardianApproved ? 'bg-agf2 text-white' : 'bg-melon'}`}>
        {draft.guardianApproved ? 'Guardian OK' : 'Awaiting approval'}
      </span>
    </div>
  </div>
)}

            </div>
          )}
        </div>
      </div>

      {/* RIGHT: actions */}
      <div className="d-flex align-items-center gap-2 ms-2 align-self-center">
        {!editing ? (
          <>
            {(status === 'pending' || status === 'standby') && canAllocate && (
              <button
                className="btn btn-sm btn-primary"
                onClick={onAllocate}
                title="Allocate coverage seat"
              >
                Allocate
              </button>
            )}
            {status === 'ready' && (
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={!canRelease}
                onClick={onRelease}
                title={canRelease ? 'Move traveler to Standby and free their seat' : 'No seat to remove'}
              >
                Move to Standby
              </button>
            )}
            <button className="btn btn-sm btn-outline-dark me-2" onClick={startEdit}>Edit</button>
          </>
        ) : (
          <>
            <button className="btn btn-sm btn-outline-secondary" onClick={cancelEdit} disabled={saving}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>
      {/* Guardian approval demo modal */}
{showGuardianDemo && (
  <div className="modal fade show" style={{display:'block'}} aria-modal="true" role="dialog">
    <div className="modal-dialog modal-sm">
      <div className="modal-content">
        <div className="modal-header">
          <h6 className="modal-title">Approval email (demo)</h6>
          <button type="button" className="btn-close" onClick={()=>setShowGuardianDemo(false)} aria-label="Close"></button>
        </div>
        <div className="modal-body small">
          <p>We would email <strong>{draft.guardian_email || 'guardian@example.com'}</strong> with an approval link.</p>
          <p>Click below to simulate the guardian approving.</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline-secondary btn-sm" onClick={()=>setShowGuardianDemo(false)}>Close</button>
          <button
            className="btn btn-success btn-sm"
            onClick={()=>{
              setShowGuardianDemo(false);
              setDraft(d => ({ ...d, guardianApproved: true }));
            }}
          >
            Simulate “Approve”
          </button>
        </div>
      </div>
    </div>
    <div className="modal-backdrop fade show" onClick={()=>setShowGuardianDemo(false)} />
  </div>
)}


    </div>
  );
}



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

const [claimMembers, setClaimMembers] = useState([]);
const [confirmModalMember, setConfirmModalMember] = useState(null);
const [guardianModalMember, setGuardianModalMember] = useState(null);
const [rosterSearch, setRosterSearch] = useState('');



// open editor with member values (normalize truthy flags)
function openEdit(member) {
  if (!member) return;
  setEditMemberId(member.member_id);
  setEditDraft({
    first_name: member.first_name || "",
    last_name:  member.last_name || "",
    email:      member.email || "",
    phone:      member.phone || "",
    confirmed:  asBool(member.confirmed),
    guardianApproved: asBool(member.guardian_approved ?? member.guardianApproved),
    active: (member.active !== false)
  });
  setShowEdit(true);
}

function closeEdit() {
  setShowEdit(false);
  setEditMemberId(null);
}
const [spotPrice, setSpotPrice] = useState(0);

  const [trip, setTrip] = useState(null)        // unified trip object with .members
  const [leader, setLeader] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingTrip, setEditingTrip] = useState(false)
  const [savingTrip, setSavingTrip] = useState(false)
  const [draft, setDraft] = useState(null)      // {title,startDate,endDate,region}
  
  //  claim stuff
const [showClaim, setShowClaim] = useState(false)
const [claimSuccess, setClaimSuccess] = useState('')
const [tripClaims, setTripClaims] = useState([])
const [rosterLoading, setRosterLoading] = useState(false);
const [rosterError, setRosterError] = useState(null);
const [rosterNotice, setRosterNotice] = useState('');
const [extraSeats, setExtraSeats] = useState(0);
const [refundableAmount, setRefundableAmount] = useState(0);
const [canRefund, setCanRefund] = useState(false);
const [ready, setReady] = useState([]);
const [pending, setPending] = useState([]);
const [coveredCount, setCoveredCount] = useState(0);
const [pendingCount, setPendingCount] = useState(0);
  const [unassignedSpots, setUnassignedSpots] = useState(0);
  const [spotAddOpen, setSpotAddOpen] = useState(false);
  const [bottomAddOpen, setBottomAddOpen] = useState(false);
  const balancePrevRef = useRef(null);
  const [balanceAlert, setBalanceAlert] = useState('');
  const hasAnyPayment = trip ? (listPayments(trip.id).length > 0) : false
  const hasStarted = trip ? (new Date(trip.startDate) <= new Date()) : false
  const [paymentTip, setPaymentTip] = useState(false);
  const [claimsTip, setClaimsTip] = useState(false);
  const [refundTip, setRefundTip] = useState(false);
  const tour = useTour();
const { completeStep: completeTourStep, disableTour, enableTour } = tour;
  const tripTourOrder = [
    'paymentSummary',
    'claims',
    'readyRoster',
    'pendingCoverage',
    'awaitingConfirmation',
    'standbyRoster',
    'addPerson'
  ];
  const activeTripStep = tour.enabled ? tripTourOrder.find(step => !tour.steps?.[step]) : null;
  const tripTourActive = tour.enabled && !!activeTripStep;

  // --- helpers ---
function parseLocalDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1); // local midnight
}

// --- derived flags ---
// --- payments & status ---
const creditsCents = trip?.creditsTotalCents || 0;
const payments = useMemo(() => (trip ? listPayments(trip.id) : []), [trip]);

// treat ledger payments or stored credits as satisfying the "paid" requirement
const hasPayments = trip ? (listPayments(trip.id).length > 0 || (trip.creditsTotalCents || 0) > 0) : false;


// --- trip timing ---
const start = parseLocalDate(trip?.startDate);
const tripStarted = !!start && (new Date() >= start);

// members
const hasMembers = !!(trip?.members?.length);

// your policy: must have paid at least once AND trip has started
const canClaim = hasPayments && tripStarted && hasMembers;

  const tourStepIndex = activeTripStep ? tripTourOrder.indexOf(activeTripStep) + 1 : 0;
  const tourStepLabel = activeTripStep ? `Step ${tourStepIndex} of ${tripTourOrder.length}` : '';
  const tourClass = (step) => (tripTourActive ? (activeTripStep === step ? 'tour-focus' : 'tour-dim') : '');

  useEffect(() => {
    if (activeTripStep === 'addPerson') {
      setBottomAddOpen(true);
    }
  }, [activeTripStep]);

  useEffect(() => {
    if (!activeTripStep) return;
    const el = document.querySelector(`[data-tour-step="${activeTripStep}"]`);
    if (!el) return;
    const target = el.getBoundingClientRect().top + window.scrollY - (window.innerHeight / 2) + (el.offsetHeight / 2);
    const start = window.scrollY;
    const distance = target - start;
    const duration = 700;
    let raf = 0;
    let startTime = 0;

    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeInOut(progress);
      window.scrollTo(0, start + distance * eased);
      if (progress < 1) {
        raf = window.requestAnimationFrame(step);
      }
    };

    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [activeTripStep]);
  
function refreshTripClaims(nextTrip = null) {
  const sourceTrip = nextTrip || trip;
  if (!sourceTrip?.id) {
    setTripClaims([]);
    return;
  }
  const allClaims = listClaims();
  const filtered = allClaims.filter(c => String(c.tripId) === String(sourceTrip.id));
  setTripClaims(filtered);
}

const normalizedRosterSearch = rosterSearch.trim().toLowerCase();

function memberMatchesSearch(member, term) {
  if (!term) return true;
  const pool = [
    member.first_name,
    member.last_name,
    `${member.first_name || ''} ${member.last_name || ''}`.trim(),
    member.firstName,
    member.lastName,
    `${member.firstName || ''} ${member.lastName || ''}`.trim(),
    member.email,
    member.guardianName,
    member.guardianEmail,
    member.guardian_email,
    member.phone,
    member.phoneNumber,
    member.color_key,
    String(member.member_id || ''),
    String(member.id || '')
  ];
  return pool.some((value) => (value || '').toString().toLowerCase().includes(term));
}

const filteredReady = useMemo(() => {
  if (!normalizedRosterSearch) return ready;
  return ready.filter((member) => memberMatchesSearch(member, normalizedRosterSearch));
}, [ready, normalizedRosterSearch]);

const filteredPending = useMemo(() => {
  if (!normalizedRosterSearch) return pending;
  return pending.filter((member) => memberMatchesSearch(member, normalizedRosterSearch));
}, [pending, normalizedRosterSearch]);

const searchActive = normalizedRosterSearch.length > 0;
const displayReady = searchActive ? filteredReady : ready;
const displayPending = searchActive ? filteredPending : pending;
const displayCoveredCount = searchActive ? displayReady.length : coveredCount;
const displayPendingCount = searchActive ? displayPending.length : pendingCount;
const standbyList = useMemo(
  () => displayPending.filter((m) => m.active === false),
  [displayPending]
);
const awaitingPayment = useMemo(
  () => displayPending.filter((m) => m.active !== false && isEligibleMember(m)),
  [displayPending]
);
const awaitingConfirmation = useMemo(
  () => displayPending.filter((m) => m.active !== false && !isEligibleMember(m)),
  [displayPending]
);


async function openClaim() {
  if (!trip?.id) return;
  setClaimSuccess('');
  try {
    const sum = await api.getRosterSummary(trip.id);
    const readyOnly = (sum.ready_roster || []).filter(m => {
      const coveredFlag = m.covered;
      if (coveredFlag === true || coveredFlag === 1 || coveredFlag === 'true') return true;
      if (coveredFlag === false || coveredFlag === 0 || coveredFlag === 'false') return false;
      return m.coverage_as_of != null;
    });
    if (readyOnly.length === 0) {
      alert('You need a covered traveler before filing a claim.');
      return;
    }
    const normalized = readyOnly.map(m => ({
      ...m,
      id: m.member_id ?? m.id,
      firstName: m.first_name ?? m.firstName ?? '',
      lastName: m.last_name ?? m.lastName ?? '',
      email: m.email || ''
    }));
    setClaimMembers(normalized);
    setShowClaim(true);
  } catch (err) {
    console.error('Unable to load claim roster', err);
    setRosterError(err?.message || 'Unable to load claim roster.');
  }
}


async function load(showSpinner = true){
  if (showSpinner) setLoading(true)
  try {
    const res = await api.getTrip(id)
    // Support both shapes: {trip, members} or a flat { ...trip, members:[...] }
    let merged = res && res.trip ? { ...res.trip, members: res.members || [] } : res
    if (merged && !Array.isArray(merged.members)) merged.members = []
    setTrip(merged)
    const leaderData = merged?.leaderId ? await api.getLeader(merged.leaderId) : null
    setLeader(leaderData)
    setSpotAddOpen(false)
    await loadRoster(merged)
    refreshTripClaims(merged)
  } finally {
    if (showSpinner) setLoading(false)
  }
}

  useEffect(()=>{ load() }, [id])

  const members = useMemo(
    () => Array.isArray(trip?.members) ? trip.members : [],
    [trip?.members]
  );
  const confirmedCount = useMemo(
    () => members.filter(isEligibleMember).length,
    [members]
  );
  const standbyAllocatable = (member) => isEligibleMember({ ...member, active: true });

  // --- Payment summary (derived from current snapshot on the trip) ---
  const days = useMemo(()=> trip ? daysBetween(trip.startDate, trip.endDate) : 0,
                       [trip?.startDate, trip?.endDate])
  const subtotal = useMemo(()=> days * confirmedCount * (trip?.rateCents || 0),
                           [days, confirmedCount, trip?.rateCents])
  // If you have credits in local storage, swap this for your real calculator:
  const credit = trip?.creditsTotalCents || 0
  const balanceDue = Math.max(0, subtotal - credit)
  const refundDue = useMemo(
    () => (canRefund ? Math.max(0, refundableAmount) : 0),
    [canRefund, refundableAmount]
  )

  useEffect(() => {
    const prev = balancePrevRef.current;
    if (prev === 0 && balanceDue > 0) {
      setBalanceAlert('Balance increased after recent updates. Please pay the new amount due.');
    } else if (balanceDue === 0) {
      setBalanceAlert('');
    }
    balancePrevRef.current = balanceDue;
  }, [balanceDue]);

  function startEdit(){
    setDraft({
      title: trip.title || '',
      startDate: trip.startDate || '',
      endDate: trip.endDate || '',
      region: trip.region || 'DOMESTIC'
    })
    setEditingTrip(true)
  }

  async function saveTripChanges() {
    if (!draft) return;
    if (!draft.title?.trim()) {
      alert('Please provide a trip title.');
      return;
    }
    if (!draft.startDate || !draft.endDate) {
      alert('Please select a start and end date.');
      return;
    }
    if (draft.startDate >= draft.endDate) {
      alert('End date must be after start date.');
      return;
    }

    setSavingTrip(true);
    try {
      await api.updateTrip(trip.id, {
        title: draft.title.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        region: draft.region
      });
      await load(false);
      setEditingTrip(false);
    } catch (err) {
      console.error(err);
      alert(err?.message || 'Unable to save trip changes.');
    } finally {
      setSavingTrip(false);
    }
  }

  async function saveEdit() {
    try {
      setSaving(true);
  
      // Build guardian object (for backend that expects nested guardian)
      const guardian = {
        first_name: draft.guardian_first_name?.trim() || "",
        last_name:  draft.guardian_last_name?.trim()  || "",
        email:      draft.guardian_email?.trim()      || "",
        phone:      draft.guardian_phone?.trim()      || "",
        approved:   !!draft.guardianApproved,
        approved_at: draft.guardianApproved ? new Date().toISOString() : null
      };
  
      // Build payload (write both flat + nested so either backend shape is satisfied)
      const payload = {
        first_name: draft.first_name.trim(),
        last_name:  draft.last_name.trim(),
        email:      draft.email.trim(),
        phone:      draft.phone.trim(),
        active: !!draft.active,
  
        isMinor: !!draft.isMinor,
        is_minor: !!draft.isMinor,
  
        confirmed:  !draft.isMinor ? !!draft.confirmed : false,
        guardianApproved: draft.isMinor ? !!draft.guardianApproved : false,
        guardian_approved: draft.isMinor ? !!draft.guardianApproved : false,
  
        guardian
      };
  
      const pk = getMemberId(member);
  
      // Attempt 1
      try {
        await api.updateMember(pk, payload);
      } catch (e) {
        if (String(e?.message || '').includes('Member not found')) {
          // Try alternate id field (string/number mismatch or different key)
          const alt = member?.member_id ?? member?.id ?? member?.memberId ?? pk;
          if (alt !== pk) {
            await api.updateMember(alt, payload);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
  
      if (onAfterSave) await onAfterSave();
      setEditing(false);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Couldn't save changes.");
    } finally {
      setSaving(false);
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

  async function handleRefundExtraSeats() {
    if (!trip) return;
    if (!window.confirm('Refund all extra paid seats?')) return;
    try {
      const res = await api.refundExtraSeats(trip.id, null);
      setRosterNotice(`Refunded ${res?.refundedSeats || 0} extra seat(s).`);
      await loadRoster();
    } catch (e) {
      alert(e?.message || 'Could not refund extra seats.');
    }
  }




  const [paying, setPaying] = useState(false); 

  async function payBalance() {
    if (!trip || balanceDue <= 0) return;
    setPaying(true);
    try {
      // Mint seats from this payment and auto-allocate to pending
      await api.applyPayment(trip.id, balanceDue, { autoAllocate: true });
      await load();   
      await loadRoster();

      try {
        const summary = await api.getRosterSummary(trip.id);
        const eligiblePending = (summary.pending_coverage || []).filter(p => p.eligible);
        for (const traveler of eligiblePending) {
          await ensureCoverageForMember(traveler.member_id);
        }
      } catch (err) {
        console.warn('Post-payment coverage sweep failed', err);
      }
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
  



// ----- Roster state (self-contained; no external hook) -----



async function loadRoster(explicitTrip) {
  const targetTrip = explicitTrip || trip;
  if (!targetTrip?.id) return;
  setRosterLoading(true);
  setRosterError(null);
  setRosterNotice('');
  try {
    let sum = await api.getRosterSummary(targetTrip.id);

    const spotPrice = sum.spot_price_cents || 0;
    const credits = Number(targetTrip?.creditsTotalCents || 0);
    if (spotPrice > 0) {
      const expectedSeats = Math.floor(credits / spotPrice);
      const currentSeats =
        (sum.ready_roster?.length || 0) +
        (sum.unassigned_spots || 0) +
        (sum.held_spots || 0);

      if (expectedSeats > currentSeats) {
        await api.applyPayment(targetTrip.id, 0, { autoAllocate: false });
        sum = await api.getRosterSummary(targetTrip.id);
      } else if (expectedSeats < currentSeats) {
        if (typeof api.syncCoverageInventory === 'function') {
          sum = await api.syncCoverageInventory(targetTrip.id);
        }
      }
    }

    // write state
    setReady(sum.ready_roster || []);
    setPending(sum.pending_coverage || []);
    setCoveredCount(sum.covered_count || 0);
    setPendingCount(sum.pending_count || 0);
    setExtraSeats(sum.extraSeats || 0);
    setRefundableAmount(sum.refundableAmount || 0);
    setCanRefund(!!sum.canRefund);
    const availableUnassigned = (sum.unassigned_spots || 0) + (sum.held_spots || 0);
    setUnassignedSpots(availableUnassigned);
    setSpotPrice(sum.spot_price_cents || 0);

    // Backfill missing credits for legacy/demo data that already minted seats
    const hasCredits = Number(targetTrip?.creditsTotalCents || 0) > 0;
    const purchasedSeats = (sum.ready_roster?.length || 0) + (sum.unassigned_spots || 0) + (sum.held_spots || 0);
    if (!hasCredits && spotPrice > 0 && purchasedSeats > 0) {
      const inferredCredits = spotPrice * purchasedSeats;
      try {
        await api.updateTrip(targetTrip.id, { creditsTotalCents: inferredCredits });
        setTrip(t => t && t.id === targetTrip.id ? { ...t, creditsTotalCents: inferredCredits } : t);
      } catch (err) {
        console.warn('Unable to backfill credits for trip', targetTrip?.id, err);
      }
    }
  } catch (e) {
    setRosterError(e);
  } finally {
    setRosterLoading(false);
  }
}

async function refreshMembers() {
  await load(false);
}

async function ensureCoverageForMember(memberId) {
  if (!trip?.id || memberId == null) {
    await refreshMembers();
    return;
  }

  let refreshedInCatch = false;

  try {
    const targetId = String(memberId);
    let summary = await api.getRosterSummary(trip.id);

    const isAlreadyReady = (summary.ready_roster || []).some(
      (m) => String(m.member_id) === targetId
    );
    if (isAlreadyReady) {
      return;
    }

    const pendingRow = (summary.pending_coverage || []).find(
      (m) => String(m.member_id) === targetId
    );

    if (!pendingRow) {
      return;
    }

    if (!pendingRow.eligible) {
      return;
    }

    if ((summary.unassigned_spots || 0) === 0) {
      const spotPrice = summary.spot_price_cents || 0;
      const credits = Number(trip?.creditsTotalCents || 0);
      if (spotPrice > 0 && credits >= spotPrice) {
        await api.applyPayment(trip.id, 0, { autoAllocate: false });
        summary = await api.getRosterSummary(trip.id);
        const refreshedPending = (summary.pending_coverage || []).find(
          (m) => String(m.member_id) === targetId
        );
        if (!refreshedPending || !refreshedPending.eligible) {
          return;
        }
      } else {
        return;
      }
    }

    const numericId = Number(memberId);
    const coverageId = Number.isFinite(numericId) ? numericId : memberId;
    await api.allocateCoverage(trip.id, coverageId);
  } catch (err) {
    console.error('Unable to auto-allocate coverage', err);
    const isSeatUnavailable = err?.message?.includes('No unassigned seats');
    await refreshMembers();
    refreshedInCatch = true;
    if (isSeatUnavailable) {
      // Expected path when traveler is confirmed before seats are purchased.
      return;
    }
    const message = err?.message || 'Unable to allocate coverage.';
    setRosterError(message);
    return;
  } finally {
    if (!refreshedInCatch) {
      await refreshMembers();
    }
  }
}

async function fetchCanonicalMember(summaryMember) {
  if (!summaryMember || !trip?.id) return null;
  try {
    const all = await api.listMembers(trip.id);
    const candidates = [
      summaryMember.member_id,
      summaryMember.id,
      summaryMember.memberId
    ].filter(v => v !== undefined && v !== null);

    let canonical = null;
    for (const candidate of candidates) {
      canonical = all.find(m => String(m.id) === String(candidate));
      if (canonical) break;
    }

    if (!canonical && summaryMember.email) {
      const emailLower = (summaryMember.email || '').toLowerCase();
      canonical = all.find(m => (m.email || '').toLowerCase() === emailLower);
    }

    if (!canonical) {
      const fn = (summaryMember.first_name || summaryMember.firstName || '').trim().toLowerCase();
      const ln = (summaryMember.last_name || summaryMember.lastName || '').trim().toLowerCase();
      const ph = (summaryMember.phone || '').replace(/\D+/g, '');
      if (fn || ln) {
        canonical = all.find(m => {
          const mFn = (m.firstName || m.first_name || '').trim().toLowerCase();
          const mLn = (m.lastName || m.last_name || '').trim().toLowerCase();
          const mPh = (m.phone || m.phoneNumber || '').replace(/\D+/g, '');
          return mFn === fn && mLn === ln && (!ph || mPh === ph);
        });
      }
    }

    if (!canonical) return null;

    const canonicalGuardian = canonical.guardian || {};
    const guardianFirst =
      canonical.guardian_first_name ??
      canonical.guardianFirst ??
      canonicalGuardian.first_name ??
      canonicalGuardian.firstName ??
      summaryMember.guardian_first_name ??
      summaryMember.guardianFirst ??
      '';
    const guardianLast =
      canonical.guardian_last_name ??
      canonical.guardianLast ??
      canonicalGuardian.last_name ??
      canonicalGuardian.lastName ??
      summaryMember.guardian_last_name ??
      summaryMember.guardianLast ??
      '';

    return {
      ...canonical,
      id: canonical.id,
      tripId: canonical.tripId ?? summaryMember.tripId ?? trip.id,
      firstName: canonical.firstName ?? canonical.first_name ?? summaryMember.first_name ?? '',
      lastName: canonical.lastName ?? canonical.last_name ?? summaryMember.last_name ?? '',
      email: canonical.email ?? summaryMember.email ?? '',
      phone: canonical.phone ?? canonical.phoneNumber ?? summaryMember.phone ?? '',
      guardianName: canonical.guardianName ?? summaryMember.guardianName ?? [guardianFirst, guardianLast].filter(Boolean).join(' '),
      guardianFirst,
      guardianLast,
      guardianEmail:
        canonical.guardianEmail ??
        canonical.guardian_email ??
        canonicalGuardian.email ??
        canonicalGuardian.emailAddress ??
        summaryMember.guardianEmail ??
        summaryMember.guardian_email ??
        '',
      guardianPhone:
        canonical.guardianPhone ??
        canonical.guardian_phone ??
        canonicalGuardian.phone ??
        canonicalGuardian.phoneNumber ??
        summaryMember.guardianPhone ??
        summaryMember.guardian_phone ??
        ''
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function handleRequestConfirm(summaryMember) {
  const canonical = await fetchCanonicalMember(summaryMember);
  if (!canonical) {
    alert('Unable to locate member record to confirm.');
    return;
  }
  setConfirmModalMember(canonical);
}

async function handleRequestGuardian(summaryMember) {
  const canonical = await fetchCanonicalMember(summaryMember);
  if (!canonical) {
    alert('Unable to locate member record for guardian approval.');
    return;
  }
  setGuardianModalMember(canonical);
}

useEffect(() => { loadRoster(); }, [trip?.id]);

// Allocate a seat for a traveler from Pending or Standby
// summaryMember = item from ready/pending/standby lists
async function handleAllocate(summaryMember) {
  try {
    if (!summaryMember) {
      alert('Unable to locate traveler to allocate seat.');
      return;
    }

    const canonical = await fetchCanonicalMember(summaryMember);
    if (!canonical || canonical.id == null) {
      alert('Unable to locate traveler to allocate seat.');
      return;
    }

    const memberId = canonical.id;

    if (canonical.active === false) {
      await api.updateMember(memberId, { active: true });
    }

    await ensureCoverageForMember(memberId);

    await refreshMembers();
    setRosterNotice('Allocated seat for traveler and moved them to Ready.');
  } catch (err) {
    console.error('Error allocating coverage for traveler', err);
    const message = err?.message || 'Unable to allocate coverage.';
    alert(message);
  }
}



async function handleRelease(memberSummary) {
  try {
    const candidates = [
      memberSummary?.member_id,
      memberSummary?.id,
      memberSummary?.memberId
    ].filter(v => v !== undefined && v !== null);
    const canonicalId = await resolveCanonicalMemberId(api, trip.id, memberSummary);
    if (canonicalId != null) candidates.unshift(canonicalId);

    let released = false;
    let alreadyReleased = false;
    let lastError = null;

    for (const candidate of candidates) {
      try {
        const res = await api.releaseCoverage(trip.id, candidate, { reason: 'Leader action' });
        released = true;
        if (res?.alreadyReleased) alreadyReleased = true;
        break;
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (!released) {
      throw lastError || new Error('Unable to identify this traveler to release coverage.');
    }

    setRosterNotice(alreadyReleased
      ? 'Seat already unassigned for this traveler.'
      : 'Moved traveler from Ready to Pending and freed a seat.'
    );
    await loadRoster(); // refresh summary/roster only
  } catch (e) {
    alert(e.message || 'Could not release coverage');
  }
}

async function handleMoveToStandby(memberSummary) {
  try {
    const candidates = [
      memberSummary?.member_id,
      memberSummary?.id,
      memberSummary?.memberId
    ].filter(v => v !== undefined && v !== null);

    const canonicalId = await resolveCanonicalMemberId(api, trip.id, memberSummary);
    if (canonicalId != null) candidates.unshift(canonicalId);

    if (candidates.length === 0) {
      throw new Error('Unable to identify this traveler to move to Standby.');
    }

    let updated = null;
    let lastError = null;
    for (const candidate of candidates) {
      try {
        updated = await api.updateMember(candidate, { active: false });
        break;
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (!updated) {
      throw lastError || new Error('Could not update traveler.');
    }

    await refreshMembers();
    setRosterNotice('Moved traveler to Standby and returned their seat to the pool.');
  } catch (e) {
    alert(e.message || 'Could not move traveler to Standby');
  }
}


  if (loading) return <div className="container py-4">Loading trip…</div>
  if (!trip) return <div className="container py-4">Trip not found.</div>

    

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



function onEditMember(memberId) {
  const m = ready.find(x => x.member_id === memberId) || pending.find(x => x.member_id === memberId);
  if (!m) return;
  openEdit(m);
}




  const isArchived = trip?.status === 'ARCHIVED';
  const tripCode = trip?.shortId || trip?.id;

  return (
    <div className="container py-4">
      <div className="row g-3 mb-4 align-items-stretch">
        <div className="col-12 col-md-6 d-flex">
          <div className="w-100">
            {!editingTrip ? (
              <>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <h2 className="h2 mb-0">{trip.title}</h2>
                  {isArchived && <span className="badge text-bg-secondary">Archived</span>}
              </div>
              <div className="text-muted mt-1">
                {trip.startDate} → {trip.endDate}
                <span className="ms-2">({days} day{days === 1 ? '' : 's'})</span>
              </div>
              <div className="mt-2 d-flex flex-wrap gap-2">
                <span className="badge bg-agf1 text-light">
                  {trip.region === 'INTERNATIONAL' ? 'International' : 'Domestic'}
                </span>
                {tripCode && (
                  <span className="badge text-bg-light">Trip ID: {tripCode}</span>
                )}
              </div>
            </>
          ) : (
            draft && (
              <div className="border rounded-3 p-3 bg-light">
                <div className="row g-3 w-100">
                  <div className="col-12">
                    <label className="form-label">Title</label>
                    <input
                      className="form-control"
                      value={draft.title}
                      onChange={e => setDraft({ ...draft, title: e.target.value })}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Start date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={draft.startDate}
                      onChange={e => setDraft({ ...draft, startDate: e.target.value })}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">End date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={draft.endDate}
                      onChange={e => setDraft({ ...draft, endDate: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <div className="form-label">Region</div>
                    <div className="d-flex gap-3 flex-wrap">
                      <label className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          checked={draft.region === 'DOMESTIC'}
                          onChange={() => setDraft({ ...draft, region: 'DOMESTIC' })}
                        />
                        <span className="form-check-label ms-2">Domestic ($1.25/day)</span>
                      </label>
                      <label className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          checked={draft.region === 'INTERNATIONAL'}
                          onChange={() => setDraft({ ...draft, region: 'INTERNATIONAL' })}
                        />
                        <span className="form-check-label ms-2">International ($4.25/day)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
          </div>
        </div>
        <div className="col-12 col-md-6 d-flex flex-column gap-2 align-items-stretch">
          {!editingTrip ? (
            <div className="px-3 py-2 border rounded-3 bg-light">
              <div className="d-flex flex-column flex-sm-row flex-wrap align-items-start align-items-sm-center justify-content-between gap-2">
                <div className="d-flex flex-column flex-sm-row gap-3 small text-uppercase">
                  <span className="text-muted">Covered</span>
                  <span className="fw-semibold" style={{ color: '#00ADBB' }}>{coveredCount}</span>
                  <span className="text-muted">Pending</span>
                  <span className="fw-semibold text-warning">{pendingCount}</span>
                </div>
                <div className="d-flex flex-wrap gap-2 justify-content-end align-items-center">
                  <div className="form-check form-switch mb-0 small">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="tourToggleTrip"
                      checked={tour.enabled}
                      onChange={(e) => {
                        if (e.target.checked) enableTour(true);
                        else disableTour();
                      }}
                    />
                    <label className="form-check-label" htmlFor="tourToggleTrip">Tour mode</label>
                  </div>
                  <button className="btn btn-outline-secondary btn-sm" onClick={startEdit}>
                    Edit Trip
                  </button>
                  {isArchived ? (
                    <button className="btn btn-sm text-dark" style={{ background: 'var(--sand)', borderColor: 'var(--sand)' }} onClick={unarchiveTrip}>
                      Restore Trip
                    </button>
                  ) : (
                    <button className="btn btn-sm text-dark" style={{ background: 'var(--sand)', borderColor: 'var(--sand)' }} onClick={archiveTrip}>
                      Archive Trip
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column flex-sm-row flex-wrap gap-2 justify-content-end">
              <button
                className="btn btn-primary btn-sm"
                onClick={saveTripChanges}
                disabled={savingTrip}
              >
                {savingTrip ? 'Saving…' : 'Save changes'}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditingTrip(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-4">
          {/* Payment Summary Card */}
          <div className={`position-relative ${tourClass('paymentSummary')}`} data-tour-step="paymentSummary">
            <div className="card">
              <div className="card-header bg-agf1 text-white fw-bold d-flex justify-content-between align-items-center">
                <span>Payment summary</span>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-white text-decoration-none p-0"
                  onClick={() => setPaymentTip(t => !t)}
                  aria-label="Toggle payment summary tip"
                >
                  <i className="bi bi-question-circle" aria-hidden="true"></i>
                </button>
              </div>
              <div className="card-body">
                {paymentTip ? (
                <TourCallout
                  title="How payments work"
                  description="Confirmed travelers drive the balance. Pay or apply credit here to cover them; once covered they move into Ready and Covered."
                  stepLabel={tourStepLabel}
                  onDismiss={() => setPaymentTip(false)}
                  dismissLabel="Close"
                  showTurnOff={false}
                />
                ) : (
                  <>
                    {balanceAlert && (
                      <InlineNotice tone="warning" dismissible timeoutMs={5000} className="mb-3">
                        <span className="small">{balanceAlert}</span>
                      </InlineNotice>
                    )}
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Confirmed People</span>
                      <strong>{confirmedCount}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Days</span>
                      <strong>{days}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Rate</span>
                      <strong>{cents(trip.rateCents || 0)} / person / day</strong>
                    </div>
                    {balanceDue === 0 && confirmedCount > 0 ? (
                      <div className="mt-3">
                        <p className="fw-bold agf1 mb-3">
                          Balance is paid right now. Keep an eye on changes—adding travelers or editing dates can reopen a balance.
                        </p>
                        <button
                          type="button"
                          className="btn btn-outline-secondary w-100"
                          onClick={() => {
                            const snap = buildReceiptSnapshot(trip, { leader });
                            openReceiptPrintWindow(snap);
                          }}
                        >
                          Print receipt
                        </button>
                      </div>
                    ) : (
                      <>
                        <hr />
                        <div className="d-flex justify-content-between">
                          <span>Subtotal</span>
                          <strong>{cents(subtotal)}</strong>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span>Trip Credits</span>
                          <strong>- {cents(credit)}</strong>
                        </div>
                        <hr />
                      </>
                    )}

                    {balanceDue > 0 && (
                      <>
                        <div className="d-flex justify-content-between">
                          <span className="text-danger">Balance due</span>
                          <strong className="text-danger">{cents(balanceDue)}</strong>
                        </div>
                        <button
                          className="btn btn-primary w-100 mt-2"
                          disabled={confirmedCount === 0 || balanceDue === 0 || paying}
                          onClick={payBalance}
                        >
                          {paying ? 'Paying…' : `Pay ${cents(balanceDue)}`}
                        </button>
                        <p className="small text-muted text-center mt-2 mb-0">
                          Payments cover confirmed travelers only.
                        </p>
                      </>
                    )}

                    {extraSeats > 0 && (
                      <InlineNotice tone="info" dismissible timeoutMs={6000} className="mt-3 mb-0">
                        <div className="fw-semibold mb-1">
                          {extraSeats} extra paid seat{extraSeats === 1 ? '' : 's'} ({cents(refundableAmount)})
                        </div>
                        <div className="small text-muted">
                          Seats that aren’t assigned to travelers can be refunded once the trip starts.
                        </div>
                        {canRefund && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary mt-2"
                            onClick={handleRefundExtraSeats}
                          >
                            Refund extra seats
                          </button>
                        )}
                      </InlineNotice>
                    )}
                  </>
                )}
              </div>
            </div>
            {activeTripStep === 'paymentSummary' && (
              <TourCallout
                className="tour-flyout"
                title="Review the payment summary"
                description="This panel tracks confirmed travelers, day rate, credits, and balance due. Pay the balance when you’re ready to mint seats."
                stepLabel={tourStepLabel}
                dismissLabel="Next"
                onDismiss={() => completeTourStep('paymentSummary')}
                onTurnOff={disableTour}
              />
            )}
          </div>

          {/* Claims + Refunds */}
          <div className={`position-relative mt-3 ${tourClass('claims')}`} data-tour-step="claims">
            <div className="card">
              <div className="card-header fw-bold bg-dark text-white d-flex justify-content-between align-items-center">
                <span>Claims</span>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-white text-decoration-none p-0"
                  onClick={() => setClaimsTip(t => !t)}
                  aria-label="Toggle claims tip"
                >
                  <i className="bi bi-question-circle" aria-hidden="true"></i>
                </button>
              </div>
              <div className="card-body">
                <p className="small text-muted">
                  When something doesn’t go as planned, that’s why we’re here.
                </p>
                {claimsTip ? (
                  <TourCallout
                    title="Claims and refunds"
                    description="File a claim after the trip starts, or request refunds for unused credits. Keep travelers added so we know who’s covered."
                    stepLabel={tourStepLabel}
                    onDismiss={() => setClaimsTip(false)}
                    dismissLabel="Close"
                    showTurnOff={false}
                  />
                ) : (
                  <>
                    <button
                      className={`btn ${canClaim ? 'btn-outline-primary' : 'btn-outline-secondary'} w-100`}
                      disabled={!canClaim}
                      onClick={() => {
                        openClaim();
                        if (activeTripStep === 'claims') completeTourStep('claims');
                      }}
                    >
                      Make a claim
                    </button>

                    {claimSuccess && (
                      <InlineNotice tone="success" dismissible timeoutMs={5000} className="mt-3 mb-0">
                        <div>{claimSuccess}</div>
                        <button
                          type="button"
                          className="btn btn-link btn-sm ps-0"
                          onClick={() => nav('/claims')}
                        >
                          View in Claims
                        </button>
                      </InlineNotice>
                    )}

                    {tripClaims.length > 0 && (
                      <div className="mt-3">
                        <div className="text-muted text-uppercase small fw-semibold mb-2">
                          Active claims
                        </div>
                        <ul className="list-unstyled mb-0 small">
                          {tripClaims.map((claim) => (
                            <li
                              key={claim.id}
                              className="d-flex justify-content-between align-items-start py-2 border-top"
                            >
                              <button
                                type="button"
                                className="btn btn-link p-0 text-start text-decoration-none me-3 flex-grow-1"
                                onClick={() => nav('/claims', { state: { highlightClaimId: claim.id } })}
                              >
                                <div className="fw-semibold text-dark">
                                  {claim.memberName || 'Traveler'}
                                </div>
                                <div className="text-muted">
                                  {claim.incidentType} — {claim.incidentDate}
                                </div>
                              </button>
                              <span className="badge text-bg-secondary text-nowrap">
                                {claim.status.replace('_', ' ')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!canClaim && (
                      <p className="small text-muted mt-2 text-center">
                        {!hasPayments ? 'You need at least one payment or credit on this trip.' :
                         !tripStarted ? 'Claims open on the trip start date.' :
                         !hasMembers  ? 'Add a traveler before filing a claim.' : null}
                      </p>
                    )}

                    {trip && (
                      <ClaimQuickModal
                        open={showClaim}
                        onClose={() => {
                          setShowClaim(false)
                        }}
                        onSubmitted={(claimRow) => {
                          setShowClaim(false)
                          setClaimSuccess('Claim submitted. We logged it for this trip.')
                          refreshTripClaims()
                        }}
                        trip={trip}
                        members={claimMembers}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Refunds Card */}
          <div className="card mt-3">
            <div className="card-header fw-bold bg-dark text-white d-flex justify-content-between align-items-center">
              <span>Refunds</span>
              <button
                type="button"
                className="btn btn-sm btn-link text-white text-decoration-none p-0"
                onClick={() => setRefundTip(t => !t)}
                aria-label="Toggle refunds tip"
              >
                <i className="bi bi-question-circle" aria-hidden="true"></i>
              </button>
            </div>
            <div className="card-body">
              {refundTip && (
                <TourCallout
                  title="Refunds"
                  description="When the trip has started, you can return unused credit here. Ready travelers stay covered; only unused credit is refunded."
                  stepLabel={tourStepLabel}
                  onDismiss={() => setRefundTip(false)}
                  dismissLabel="Close"
                  showTurnOff={false}
                />
              )}
              <p className="small text-muted mb-3">
                Refunds return unused trip credits after the itinerary has started. Use this if a covered traveler can no longer go.
              </p>
              <button
                className="btn btn-outline-success w-100"
                disabled={!canRefund || refundDue === 0 || refunding}
                onClick={refundAllCredits}
              >
                {refunding ? 'Processing…' : `Request refund ${cents(refundDue)}`}
              </button>
                <p className="small text-center mt-2 mb-0">
                  Refunds can be initiated after the first date of the trip.
                </p>
              </div>
            </div>

            {activeTripStep === 'claims' && (
              <TourCallout
                className="tour-flyout"
                title="Claims and refunds"
                description="File a claim once the trip has started, and request refunds for unused credits. Both live here."
                stepLabel={tourStepLabel}
                dismissLabel="Next"
                onDismiss={() => completeTourStep('claims')}
                onTurnOff={disableTour}
              />
            )}
          </div>
        </div>
        <div className="col-lg-8 d-flex flex-column gap-3">
          <TripMembersList
            ready={displayReady}
            awaitingPayment={awaitingPayment}
            awaitingConfirmation={awaitingConfirmation}
            standby={standbyList}
            coveredCount={displayCoveredCount}
            unassignedSpots={unassignedSpots}
            spotAddOpen={spotAddOpen}
            onSpotAddToggle={setSpotAddOpen}
            searchTerm={rosterSearch}
            onSearchTermChange={setRosterSearch}
            searchActive={searchActive}
            onMemberFocus={(label) => setRosterSearch((label || '').trim())}
            tourActiveStep={tripTourActive ? activeTripStep : null}
            tourStepLabel={tourStepLabel}
            tourStepIndex={tourStepIndex}
            tourStepTotal={tripTourOrder.length}
            onTourDismiss={completeTourStep}
            onTourTurnOff={disableTour}
            rosterNotice={rosterNotice}
            spotAddForm={(
              <TripMemberAddForm
                tripId={trip.id}
                compact
                onAdded={() => {
                  setSpotAddOpen(false);
                  load(false);
                }}
                onCancel={() => setSpotAddOpen(false)}
              />
            )}
            bottomAddOpen={bottomAddOpen}
            onBottomAddToggle={setBottomAddOpen}
            bottomAddForm={(
              <TripMemberAddForm
                tripId={trip.id}
                compact
                onAdded={() => {
                  setBottomAddOpen(false);
                  load(false);
                }}
                onCancel={() => setBottomAddOpen(false)}
              />
            )}
            rosterError={rosterError}
            renderReadyItem={(member) => (
              <MemberRow
                key={member.member_id}
                tripId={trip.id}
                member={member}
                status="ready"
                onAfterSave={refreshMembers}
                onRequestConfirm={handleRequestConfirm}
                onRequestGuardian={handleRequestGuardian}
                onAllocate={undefined}
                onRelease={() => handleMoveToStandby(member)}
                canAllocate={false}
                canRelease={true}
              />
            )}
            renderPendingItem={(member) => (
              <MemberRow
                key={member.member_id}
                tripId={trip.id}
                member={member}
                status="pending"
                onAfterSave={refreshMembers}
                onRequestConfirm={handleRequestConfirm}
                onRequestGuardian={handleRequestGuardian}
                onAllocate={() => handleAllocate(member)}
                onRelease={undefined}
                canAllocate={isEligibleMember(member) && unassignedSpots > 0}
                canRelease={false}
              />
            )}
            renderStandbyItem={(member) => (
              <MemberRow
                key={member.member_id}
                tripId={trip.id}
                member={member}
                status="standby"
                onAfterSave={refreshMembers}
                onRequestConfirm={handleRequestConfirm}
                onRequestGuardian={handleRequestGuardian}
                onAllocate={() => handleAllocate(member)}
                onRelease={undefined}
                canAllocate={standbyAllocatable(member) && unassignedSpots > 0}
                canRelease={false}
              />
            )}
          />
        </div>



        <MemberConfirmModal
          open={!!confirmModalMember}
          member={confirmModalMember}
          onClose={() => setConfirmModalMember(null)}
          onDone={async (confirmedMember) => {
            const targetId = confirmedMember?.id ?? confirmModalMember?.id;
            await ensureCoverageForMember(targetId);
          }}
        />
        <GuardianApprovalModal
          open={!!guardianModalMember}
          member={guardianModalMember}
          onClose={() => setGuardianModalMember(null)}
          onDone={async (approvedMember) => {
            const targetId = approvedMember?.id ?? guardianModalMember?.id;
            await ensureCoverageForMember(targetId);
          }}
        />

      </div>
    </div>
  )
}
