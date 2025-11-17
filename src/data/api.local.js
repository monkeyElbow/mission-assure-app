import { store } from '../core/storage';
import { seedRatesIfEmpty, selectRate } from '../core/rates';

// === Polyfill store.add / store.put for local mock tables ===
if (typeof store?.add !== 'function') {
  store.add = function(name, row) {
    return store.insert(name, row);
  };
}

if (typeof store?.put !== 'function') {
  store.put = function(name, row) {
    const arr = store.all(name) || [];
    if (!Array.isArray(arr)) throw new Error(`store.all(${name}) must return an array for local mocks.`);
    // Pick an id key to match on (spot_id, event_id, or id)
    const idKey = ('spot_id' in row) ? 'spot_id' : (('event_id' in row) ? 'event_id' : 'id');
    const idx = arr.findIndex(r => r && r[idKey] === row[idKey]);
    if (idx >= 0) arr[idx] = row; else arr.push(row);
    return row;
  };
}

// ===== Coverage & Claims (local mock) — helpers & table ids =====
const T_COVERAGE = 'coverage_allocations';
const T_EVENTS   = 'event_log';

function ulid() {
  // Tiny ULID-ish generator good enough for local mocks
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return (t + r).toUpperCase();
}

function isoNow() { return new Date().toISOString(); }

function daysInclusive(aIso, bIso){
  if (!aIso || !bIso) return 0;
  const a = new Date(aIso), b = new Date(bIso);
  const ms = b.setHours(0,0,0,0) - a.setHours(0,0,0,0);
  return ms < 0 ? 0 : Math.floor(ms/86400000) + 1;
}

function computeSpotPriceCents(trip){
  const days = daysInclusive(trip.startDate, trip.endDate);
  return days * (trip.rateCents || 0);
}

// simple chain hash for tamper-evidence (mock)
function eventHash(prevHash, eventObj){
  const json = prevHash + JSON.stringify(eventObj);
  let h = 0x811c9dc5;
  for (let i=0; i<json.length; i++){
    h ^= json.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

function appendEvent({
  actorId='LEAD_LOCAL',
  actorRole='LEADER',
  trip,
  type,
  memberId=null,
  fromMemberId=null,
  toMemberId=null,
  amountCents=null,
  notes=null,
  creditsBeforeCents=null,
  creditsAfterCents=null,
  spotPriceCents=null
}){
  const events = store.all(T_EVENTS);
  const prev_hash = events.length ? events[events.length-1].hash : '0'.repeat(8);
  const spotPrice = spotPriceCents != null ? spotPriceCents : (trip.spot_price_cents || computeSpotPriceCents(trip));
  const creditsBefore = creditsBeforeCents != null ? creditsBeforeCents : (trip.creditsTotalCents ?? 0);
  const creditsAfter = creditsAfterCents != null ? creditsAfterCents : (trip.creditsTotalCents ?? 0);
  const e = {
    event_id: ulid(),
    timestamp: isoNow(),
    actor_id: actorId,
    actor_role: actorRole,
    trip_id: trip.id,
    trip_title: trip.title || trip.shortId || 'Trip',
    type,
    member_id: memberId,
    from_member_id: fromMemberId,
    to_member_id: toMemberId,
    amount_cents: amountCents,
    spot_price_cents: spotPrice,
    credits_before_cents: creditsBefore,
    credits_after_cents: creditsAfter,
    notes,
    prev_hash,
    hash: 'PENDING'
  };
  e.hash = eventHash(prev_hash, e);
  store.add(T_EVENTS, e);
  return e;
}

function memberPrimaryId(member) {
  if (!member) return null;
  return member.id ?? member.member_id ?? member.memberId ?? null;
}

function firstNonEmpty(obj, keys, fallback = '') {
  for (const key of keys || []) {
    const value = obj?.[key];
    if (value != null && String(value).trim() !== '') return value;
  }
  return fallback;
}

function memberFlags(member = {}) {
  const guardian = member.guardian || {};
  const isMinor =
    truthy(member.isMinor) ||
    truthy(member.minor) ||
    truthy(member.is_minor);
  const confirmed =
    truthy(member.confirmed) ||
    truthy(member.is_confirmed) ||
    truthy(member.confirmedAt) ||
    truthy(member.confirmed_at);
  const guardianApproved =
    truthy(member.guardianApproved) ||
    truthy(member.guardian_approved) ||
    truthy(member.guardianApproval) ||
    truthy(guardian.approved);
  const active =
    member.active === undefined ? true : truthy(member.active);
  return { isMinor, confirmed, guardianApproved, active };
}

function extractGuardian(member = {}) {
  const guardian = member.guardian || {};
  const first = firstNonEmpty(guardian, ['first_name', 'firstName']);
  const last = firstNonEmpty(guardian, ['last_name', 'lastName']);
  const email = firstNonEmpty(guardian, ['email', 'emailAddress']) ||
    firstNonEmpty(member, ['guardian_email', 'guardianEmail']);
  const phone = firstNonEmpty(guardian, ['phone', 'phoneNumber']) ||
    firstNonEmpty(member, ['guardian_phone', 'guardianPhone']);
  const approved =
    truthy(guardian.approved) ||
    truthy(member.guardianApproved) ||
    truthy(member.guardian_approved);
  return { first, last, email, phone, approved };
}

function formatGuardianSummary(member = {}) {
  const { first, last, email, phone, approved } = extractGuardian(member);
  if (!first && !last && !email && !phone) return '';
  const name = [first, last].filter(Boolean).join(' ').trim();
  const contact = [email, phone].filter(Boolean).join(' | ');
  const bits = [];
  if (name) bits.push(name);
  if (contact) bits.push(contact);
  bits.push(`Approved: ${approved ? 'Yes' : 'No'}`);
  return `Guardian: ${bits.join(' | ')}`;
}

function formatUsd(amountCents) {
  if (amountCents == null) return '';
  const dollars = Number(amountCents) / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dollars);
}

function memberSnapshot(tripId, member, { includeGuardian = false } = {}) {
  if (!member) return 'Member unavailable';
  const id = memberPrimaryId(member);
  const label = memberLabel(member) || (id ? `Member ${id}` : 'Member');
  const email = firstNonEmpty(member, ['email', 'emailAddress']);
  const phone = firstNonEmpty(member, ['phone', 'phoneNumber']);
  const contact = [email, phone].filter(Boolean).join(' | ');

  const flags = memberFlags(member);
  const spot = tripId && id != null ? getAssignedSpotForMember(tripId, id) : null;
  const coverage = spot ? 'Covered' : 'Pending';

  const details = [`Coverage: ${coverage}`];
  details.push(`Active: ${flags.active ? 'Yes' : 'No'}`);
  details.push(`Confirmed: ${flags.confirmed ? 'Yes' : 'No'}`);
  details.push(`Minor: ${flags.isMinor ? 'Yes' : 'No'}`);
  if (flags.isMinor) {
    details.push(`Guardian OK: ${flags.guardianApproved ? 'Yes' : 'No'}`);
  }

  const parts = [];
  parts.push(contact ? `${label} (${contact})` : label);
  parts.push(details.join(' | '));

  if (includeGuardian) {
    const guardian = formatGuardianSummary(member);
    if (guardian) parts.push(guardian);
  }

  return parts.filter(Boolean).join(' | ');
}

function canonicalMemberView(member = {}) {
  const flags = memberFlags(member);
  const guardian = extractGuardian(member);
  return {
    firstName: firstNonEmpty(member, ['first_name', 'firstName']) || 'N/A',
    lastName: firstNonEmpty(member, ['last_name', 'lastName']) || 'N/A',
    email: firstNonEmpty(member, ['email', 'emailAddress']) || 'N/A',
    phone: firstNonEmpty(member, ['phone', 'phoneNumber']) || 'N/A',
    active: flags.active ? 'Yes' : 'No',
    confirmed: flags.confirmed ? 'Yes' : 'No',
    minor: flags.isMinor ? 'Yes' : 'No',
    guardianApproved: flags.guardianApproved ? 'Yes' : 'No',
    guardianName: [guardian.first, guardian.last].filter(Boolean).join(' ') || 'N/A',
    guardianEmail: guardian.email || 'N/A',
    guardianPhone: guardian.phone || 'N/A'
  };
}

function buildChangeSummary(changes) {
  if (!changes || changes.length === 0) return '';
  return changes.map(([field, fromVal, toVal]) => {
    const from = fromVal == null || fromVal === '' ? 'N/A' : String(fromVal);
    const to = toVal == null || toVal === '' ? 'N/A' : String(toVal);
    return `${field}: ${from} -> ${to}`;
  }).join(' | ');
}

// tolerant boolean coercion
function truthy(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

// ELIGIBILITY:
function memberEligible(m){
  if (!m) return false;
  const isMinor =
    truthy(m.isMinor) || truthy(m.minor) || truthy(m.is_minor);
  const confirmedAdult =
    truthy(m.confirmed) || truthy(m.isConfirmed);
  const guardianOK =
    truthy(m.guardianApproved) || truthy(m.guardian_approved) || truthy(m.guardianApproval);
  const active = (m.active === undefined) ? true : truthy(m.active);
  return (isMinor ? guardianOK : confirmedAdult) && active;
}




function colorKeyFor(m){
  const slug = `${m.firstName||''}-${m.lastName||''}-${m.email||m.id||''}`.toLowerCase().replace(/\s+/g,'-');
  return slug || (m.id || 'member');
}

function memberLabel(m){
  const first = m.firstName ?? m.first_name ?? '';
  const last = m.lastName ?? m.last_name ?? '';
  const name = `${first} ${last}`.trim();
  return name || m.email || m.id;
}

function getAllocationsByTrip(tripId){
  return store.all(T_COVERAGE).filter(s => s.trip_id === tripId);
}

function getAssignedSpotForMember(tripId, memberId){
  return getAllocationsByTrip(tripId).find(s => s.status === 'ASSIGNED' && s.member_id === memberId) || null;
}

function rebalanceCoverage(tripId) {
  const trip = store.byId(T_TRIPS, tripId);
  if (!trip) return;

  trip.spot_price_cents = trip.spot_price_cents || computeSpotPriceCents(trip);
  store.put(T_TRIPS, trip);

  const spotPrice = trip.spot_price_cents || 0;
  const credits = Number(trip.creditsTotalCents || 0);

  const members = store.where(T_MEMBERS, m => m.tripId === tripId);
  const eligibleMembers = members
    .filter(memberEligible)
    .sort((a, b) => {
      const aKey = `${a.confirmedAt || a.confirmed_at || ''}|${(a.lastName || '').toLowerCase()}|${(a.firstName || '').toLowerCase()}`;
      const bKey = `${b.confirmedAt || b.confirmed_at || ''}|${(b.lastName || '').toLowerCase()}|${(b.firstName || '').toLowerCase()}`;
      return aKey.localeCompare(bKey);
    });

  const creditSeats = spotPrice > 0 ? Math.floor(credits / spotPrice) : Number.MAX_SAFE_INTEGER;

  let spots = getAllocationsByTrip(tripId);
  const assignedSeats = spots.filter(s => s.status === 'ASSIGNED');
  const assignedCount = assignedSeats.length;

  let desiredSeats;
  if (creditSeats === Number.MAX_SAFE_INTEGER) {
    desiredSeats = Math.max(assignedCount, eligibleMembers.length);
  } else {
    desiredSeats = Math.max(assignedCount, creditSeats);
  }

  const removable = spots.filter(s => s.status === 'UNASSIGNED');
  while (spots.length > desiredSeats && removable.length) {
    const seat = removable.pop();
    const key = seat?.id ?? seat?.spot_id;
    if (key != null) {
      store.remove(T_COVERAGE, key);
    }
    spots = getAllocationsByTrip(tripId);
  }

  while (spots.length < desiredSeats) {
    store.add(T_COVERAGE, {
      spot_id: ulid(),
      trip_id: tripId,
      member_id: null,
      status: 'UNASSIGNED',
      allocated_at: null,
      released_at: null,
      notes: null
    });
    spots = getAllocationsByTrip(tripId);
  }

  const refreshedSpots = spots;
  const assignedIds = new Set(
    refreshedSpots.filter(s => s.status === 'ASSIGNED').map(s => s.member_id)
  );

  const queue = eligibleMembers.filter(m => !assignedIds.has(m.id));
  for (const seat of refreshedSpots) {
    if (queue.length === 0) break;
    if (seat.status !== 'UNASSIGNED') continue;
    const nextMember = queue.shift();
    if (!nextMember) break;
    seat.status = 'ASSIGNED';
    seat.member_id = nextMember.id;
    seat.allocated_at = isoNow();
    store.put(T_COVERAGE, seat);
    appendEvent({
      trip,
      type:'COVERAGE_ALLOCATED',
      memberId: nextMember.id,
      notes: `Auto-assigned seat to ${memberSnapshot(tripId, nextMember)}`
    });
  }
}

function summaryForTrip(trip){
  const members = store.all(T_MEMBERS).filter(m => m.tripId === trip.id);
  const spots   = getAllocationsByTrip(trip.id);
  const assigned = spots.filter(s => s.status === 'ASSIGNED');
  const unassigned = spots.filter(s => s.status === 'UNASSIGNED');
  const held = spots.filter(s => s.status === 'HELD');

  const assignedIds = new Set(assigned.map(s => s.member_id));

function truthy(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

  function mapMember(m, spot, covered) {
    const guardian = m.guardian || {};
    const confirmed =
      truthy(m.confirmed) ||
      truthy(m.is_confirmed) ||
      truthy(m.isConfirmed) ||
      !!m.confirmedAt ||
      !!m.confirmed_at;
    const guardianApproved =
      truthy(m.guardianApproved) ||
      truthy(m.guardian_approved) ||
      truthy(m.guardianApproval) ||
      truthy(guardian.approved);
    const active = (m.active === undefined) ? true : truthy(m.active);
    const eligible = memberEligible(m);

    const guardianFirst =
      m.guardian_first_name ??
      m.guardianFirst ??
      guardian.first_name ??
      guardian.firstName ??
      '';
    const guardianLast =
      m.guardian_last_name ??
      m.guardianLast ??
      guardian.last_name ??
      guardian.lastName ??
      '';
    const guardianEmail =
      m.guardian_email ??
      m.guardianEmail ??
      guardian.email ??
      '';
    const guardianPhone =
      m.guardian_phone ??
      m.guardianPhone ??
      guardian.phone ??
      '';
    const guardianName =
      m.guardianName ||
      [guardianFirst, guardianLast].filter(Boolean).join(' ');

    return {
      id: m.id,
      memberId: m.id,
      member_id: m.id,
      first_name: m.firstName || '',
      last_name: m.lastName || '',
      firstName: m.firstName || '',
      lastName: m.lastName || '',
      email: m.email || '',
      phone: m.phone ?? m.phoneNumber ?? '',
      is_minor: truthy(m.isMinor) || truthy(m.minor) || truthy(m.is_minor),
      minor: truthy(m.isMinor) || truthy(m.minor) || truthy(m.is_minor),
      isMinor: truthy(m.isMinor) || truthy(m.minor) || truthy(m.is_minor),
      confirmed,
      is_confirmed: confirmed,
      confirmed_at: m.confirmedAt ?? m.confirmed_at ?? null,
      guardianApproved,
      guardian_approved: guardianApproved,
      guardianName,
      guardianEmail,
      guardianPhone,
      guardianFirst: guardianFirst,
      guardianLast: guardianLast,
      guardian_first_name: guardianFirst,
      guardian_last_name: guardianLast,
      guardian_email: guardianEmail,
      guardian_phone: guardianPhone,
      guardian: {
        first_name: guardianFirst,
        last_name: guardianLast,
        email: guardianEmail,
        phone: guardianPhone,
        approved: guardianApproved,
        approved_at: guardian.approved_at ?? guardian.approvedAt ?? null
      },
      active,
      eligible,
      covered,
      coverage_as_of: spot?.allocated_at || null,
      color_key: colorKeyFor(m)
    };
  }

  const ready_roster = members
    .filter(m => assignedIds.has(m.id) && memberEligible(m))
    .map(m => {
      const spot = assigned.find(s => s.member_id === m.id);
      return mapMember(m, spot, true);
    });

  const pending_coverage = members
    .filter(m => !assignedIds.has(m.id))
    .map(m => mapMember(m, null, false));

  const eligible_pending_count = pending_coverage.filter(m => m.eligible).length;

  const spot_price_cents = trip.spot_price_cents || computeSpotPriceCents(trip);

  return {
    trip_id: trip.id,
    trip_title: trip.title || trip.shortId || 'Trip',
    spot_price_cents,
    covered_count: ready_roster.length,
    pending_count: pending_coverage.length,
    eligible_pending_count,
    unassigned_spots: unassigned.length,
    held_spots: held.length,
    ready_roster,
    pending_coverage
  };
}


const T_TRIPS = 'trips';
const T_MEMBERS = 'members';

function nextTripShortId(){
    const y = new Date().getFullYear();
    const seq = (store.all('trips').length + 1).toString().padStart(6, '0');
    return `MA-${y}-${seq}`;
  }

// Demo trip templates and seeding util (reused by admin + legacy seed)
const DEMO_TRIPS = [
  {
    title: 'Serve St. Louis',
    region: 'DOMESTIC',
    startDate: '2025-06-05',
    endDate: '2025-06-12',
    paymentStatus: 'PAID',
    coverSpots: 2,
    members: [
      { first_name: 'Sam', last_name: 'Lopez', email: 'sam@example.com', confirmed: true, active: true },
      { first_name: 'Jordan', last_name: 'Kim', email: 'jordan@example.com', confirmed: true, active: true },
      { first_name: 'Lee', last_name: 'Nguyen', email: 'lee@example.com', confirmed: false, active: true },
      { first_name: 'Taylor', last_name: 'Bennett', email: 'taylor@example.com', confirmed: false, active: true }
    ]
  },
  {
    title: 'Guatemala Outreach',
    region: 'INTERNATIONAL',
    startDate: '2025-08-02',
    endDate: '2025-08-12',
    paymentStatus: 'PAID',
    coverSpots: 3,
    members: [
      { first_name: 'Marisol', last_name: 'Garcia', email: 'marisol@example.com', confirmed: true, active: true },
      { first_name: 'Caleb', last_name: 'Walker', email: 'caleb@example.com', confirmed: true, active: true },
      { first_name: 'Ivy', last_name: 'Allen', email: 'ivy@example.com', confirmed: false, active: true },
      { first_name: 'Noah', last_name: 'Wheeler', email: 'noah@example.com', is_minor: true, guardianApproved: true, guardian_email: 'guardian.noah@example.com' }
    ]
  },
  {
    title: 'College Retreat',
    region: 'DOMESTIC',
    startDate: '2025-10-18',
    endDate: '2025-10-21',
    paymentStatus: 'UNPAID',
    coverSpots: 1,
    members: [
      { first_name: 'Riley', last_name: 'Morgan', email: 'riley@example.com', confirmed: true, active: true },
      { first_name: 'Sky', last_name: 'Patel', email: 'sky@example.com', confirmed: false, active: true }
    ]
  }
];

const demoTitleKey = (s = '') => String(s || '').trim().toLowerCase();

async function runDemoSeed({ force = false, onlyWhenEmpty = false } = {}) {
  seedRatesIfEmpty();
  const existingTrips = store.all(T_TRIPS);
  if (onlyWhenEmpty && existingTrips.length > 0) {
    return { added: 0, total: existingTrips.length };
  }

  const existingKeys = new Set(existingTrips.map(t => demoTitleKey(t.title)));
  let added = 0;

  for (const tmpl of DEMO_TRIPS) {
    const key = demoTitleKey(tmpl.title);
    if (existingKeys.has(key)) continue;
    if (!force && !onlyWhenEmpty && existingKeys.has(key)) continue;

    const trip = await api.createTrip({
      title: tmpl.title,
      region: tmpl.region,
      startDate: tmpl.startDate,
      endDate: tmpl.endDate
    });

    const spotPrice = computeSpotPriceCents(trip);
    const seatsToCover = Math.max(0, tmpl.coverSpots || 0);
    const creditsNeeded = Math.max(0, spotPrice * seatsToCover);
    if (creditsNeeded > 0) {
      await api.applyPayment(trip.id, creditsNeeded, { autoAllocate: false });
    }

    let members = [];
    if (Array.isArray(tmpl.members) && tmpl.members.length) {
      members = await api.addMembers(trip.id, tmpl.members);
    }

    const confirmedMembers = members.filter(m => {
      const flags = memberFlags(m);
      return flags.isMinor ? flags.guardianApproved : flags.confirmed;
    });

    for (const m of confirmedMembers.slice(0, seatsToCover || confirmedMembers.length)) {
      try {
        await api.allocateCoverage(trip.id, m.id);
      } catch (err) {
        console.warn('Demo coverage allocation failed', err);
      }
    }

    await api.updateTrip(trip.id, {
      paymentStatus: tmpl.paymentStatus || (creditsNeeded > 0 ? 'PAID' : 'UNPAID'),
      status: tmpl.status || 'ACTIVE',
      isDemo: true
    });

    existingKeys.add(key);
    added += 1;
  }

  return { added, total: store.all(T_TRIPS).length };
}

export const api = {
// ===== Roster Summary (mock) =====
async getRosterSummary(tripId){
  const trip = store.byId(T_TRIPS, tripId);
  if (!trip) throw new Error('Trip not found');
  rebalanceCoverage(tripId);
  const refreshedTrip = store.byId(T_TRIPS, tripId);
  // ensure cached spot price
  if (!refreshedTrip.spot_price_cents) {
    refreshedTrip.spot_price_cents = computeSpotPriceCents(refreshedTrip);
    store.put(T_TRIPS, refreshedTrip);
  }
  return summaryForTrip(refreshedTrip);
},

// ===== Allocate Coverage (assign an unassigned spot to a confirmed member) =====
async allocateCoverage(tripId, memberId, { idempotencyKey } = {}){
  const trip = store.byId(T_TRIPS, tripId);
  if (!trip) throw new Error('Trip not found');
  const member = store.byId(T_MEMBERS, memberId);
  if (!member || member.tripId !== tripId) throw new Error('Member not found');

  if (!memberEligible(member)) throw new Error('Member not eligible (must be confirmed/active; minors need guardian approval)');
  if (getAssignedSpotForMember(tripId, memberId)) return { ok:true, alreadyCovered:true, ...summaryForTrip(trip) };

  const spots = getAllocationsByTrip(tripId);
  const open = spots.find(s => s.status === 'UNASSIGNED');
  if (!open) throw new Error('No unassigned spots available');

  open.status = 'ASSIGNED';
  open.member_id = memberId;
  open.allocated_at = isoNow();
  store.put(T_COVERAGE, open);

  appendEvent({
    trip,
    type:'COVERAGE_ALLOCATED',
    memberId,
    notes: `Seat assigned to ${memberSnapshot(tripId, member)}`
  });

  return { ok:true, spot_id: open.spot_id, coverage_as_of: open.allocated_at, ...summaryForTrip(trip) };
},

// ===== Release Coverage (move assigned spot back to pool or hold) =====
async releaseCoverage(tripId, memberId, { reason=null, holdAfterStart=false, idempotencyKey } = {}){
  const trip = store.byId(T_TRIPS, tripId);
  if (!trip) throw new Error('Trip not found');
  const member = store.byId(T_MEMBERS, memberId);
  if (!member || member.tripId !== tripId) throw new Error('Member not found');

  const spot = getAssignedSpotForMember(tripId, memberId);
  if (!spot) return { ok:true, alreadyReleased:true, ...summaryForTrip(trip) };

  spot.status = holdAfterStart ? 'HELD' : 'UNASSIGNED';
  spot.member_id = holdAfterStart ? memberId : null;
  spot.released_at = isoNow();
  store.put(T_COVERAGE, spot);

  const releaseNotes = [
    `Released coverage for ${memberSnapshot(tripId, member)}`,
    holdAfterStart ? 'Seat placed on hold' : 'Seat returned to pool'
  ];
  if (reason) releaseNotes.push(`Reason: ${reason}`);
  appendEvent({
    trip,
    type:'COVERAGE_RELEASED',
    memberId,
    notes: releaseNotes.join(' | ')
  });

  const sum = summaryForTrip(trip);
  return {
    ok:true,
    released_spot_id: spot.spot_id,
    status: holdAfterStart ? 'HELD' : 'UNASSIGNED',
    covered_count: sum.covered_count,
    unassigned_spots: sum.unassigned_spots,
    held_spots: sum.held_spots
  };
},

// ===== Transfer Coverage (A -> B in one action) =====
async transferCoverage(tripId, fromMemberId, toMemberId, { idempotencyKey } = {}){
  if (fromMemberId === toMemberId) throw new Error('Cannot transfer to the same member');
  const trip = store.byId(T_TRIPS, tripId);
  if (!trip) throw new Error('Trip not found');
  const from = store.byId(T_MEMBERS, fromMemberId);
  const to   = store.byId(T_MEMBERS, toMemberId);
  if (!from || from.tripId !== tripId) throw new Error('From-member not found');
  if (!to   || to.tripId   !== tripId) throw new Error('To-member not found');
  if (!memberEligible(to)) throw new Error('Target member not eligible');

  const fromSpot = getAssignedSpotForMember(tripId, fromMemberId);
  if (!fromSpot) throw new Error('From-member has no assigned coverage');
  if (getAssignedSpotForMember(tripId, toMemberId)) return { ok:true, alreadyCovered:true, ...summaryForTrip(trip) };

  // release -> allocate atomically (mock)
  fromSpot.status = 'UNASSIGNED';
  fromSpot.member_id = null;
  fromSpot.released_at = isoNow();
  store.put(T_COVERAGE, fromSpot);

  fromSpot.status = 'ASSIGNED';
  fromSpot.member_id = toMemberId;
  fromSpot.allocated_at = isoNow();
  store.put(T_COVERAGE, fromSpot);

  appendEvent({
    trip,
    type:'COVERAGE_TRANSFERRED',
    fromMemberId,
    toMemberId,
    notes: `Transfer: ${memberSnapshot(tripId, from)} -> ${memberSnapshot(tripId, to)}`
  });

  return { ok:true, spot_id: fromSpot.spot_id, coverage_as_of: fromSpot.allocated_at, ...summaryForTrip(trip) };
},

// ===== Claims (simple submit) =====
async createClaim({ trip_id, member_id, incident_type, description, incident_date, incident_location }){
  const trip = store.byId(T_TRIPS, trip_id);
  if (!trip) throw new Error('Trip not found');

  const sum = summaryForTrip(trip);
  const readyIds = new Set(sum.ready_roster.map(r => r.member_id));
  if (!readyIds.has(member_id)) throw new Error('Traveler must be covered to file a claim');

  const claim_id = `CLM-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  const member = store.byId(T_MEMBERS, member_id);
  const incidentBits = [
    incident_type ? incident_type : null,
    incident_date ? `on ${incident_date}` : null,
    incident_location ? `@ ${incident_location}` : null
  ].filter(Boolean).join(' ');
  const pieces = [];
  if (member) pieces.push(`Claim for ${memberSnapshot(trip_id, member, { includeGuardian: false })}`);
  if (incidentBits) pieces.push(`Incident: ${incidentBits}`);
  if (description) pieces.push(`Description: ${description}`);
  appendEvent({
    trip,
    type:'CLAIM_SUBMITTED',
    memberId: member_id,
    notes: pieces.join(' | ') || 'Claim submitted'
  });

  return { ok:true, claim_id, status:'SUBMITTED' };
},

// ===== Admin History (filterable, with simple chain flag) =====
async getTripHistory(tripId, { start=null, end=null, type=null, member_id=null, actor_id=null } = {}){
  const trip = store.byId(T_TRIPS, tripId);
  if (!trip) throw new Error('Trip not found');
  let rows = store.all(T_EVENTS).filter(e => e.trip_id === tripId);

  if (start) rows = rows.filter(e => e.timestamp >= start);
  if (end)   rows = rows.filter(e => e.timestamp <= end);
  if (type)  {
    const types = Array.isArray(type) ? type : [type];
    rows = rows.filter(e => types.includes(e.type));
  }
  if (member_id) rows = rows.filter(e => e.member_id === member_id || e.from_member_id === member_id || e.to_member_id === member_id);
  if (actor_id)  rows = rows.filter(e => e.actor_id === actor_id);

  // naive chain verify (recompute)
  let prev = '0'.repeat(8), ok = true;
  for (const e of rows){
    const h = eventHash(prev, e);
    if (h !== e.hash) { ok = false; break; }
    prev = e.hash;
  }
  return { trip_id: tripId, chain_valid: ok, events: rows, export_url: `/admin/export/trips/${tripId}/history` };
},

    async deleteTrip(id){
        // delete trip
        store.remove(T_TRIPS, id);
      
        // delete members for this trip
        const toDelete = store.where(T_MEMBERS, m => m.tripId === id);
        for (const m of toDelete) store.remove(T_MEMBERS, m.id);
      
        // optional: delete claims tied to this trip (if claims module present)
        try {
          const { removeClaimsForTrip } = await import('../core/claims');
          removeClaimsForTrip(id);
        } catch {} // ignore if claims module not loaded
      
        return true;
      },
      
  async listTrips(){
    return store
      .all(T_TRIPS)
      .sort((a,b)=>+new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async getTrip(id){
    const trip = store.byId(T_TRIPS, id);
    const members = store.where(T_MEMBERS, m => m.tripId === id);
    return { trip, members };
  },

  async createTrip(input){ // {title,startDate,endDate,region}
    seedRatesIfEmpty();
    const { startDate, endDate } = input || {};
    if (startDate && endDate && startDate >= endDate) {
      throw new Error('End date must be after start date.');
    }
    const rate = selectRate(input.region, input.startDate);
    if (!rate) throw new Error('No applicable rate for that start date.');
    const now = new Date().toISOString();
    const trip = store.insert(T_TRIPS, {
        shortId: nextTripShortId(),        // NEW
        ...input,
        rateCents: rate.amountCents,
        paymentStatus: 'UNPAID',           // NEW: UNPAID | PAID
        status: 'ACTIVE',
        createdAt: now, updatedAt: now
      });
    appendEvent({
      trip,
      type: 'TRIP_CREATED',
      notes: [
        trip.title || trip.shortId || 'Trip created',
        trip.startDate && trip.endDate ? `Dates: ${trip.startDate} -> ${trip.endDate}` : '',
        trip.region ? `Region: ${trip.region}` : '',
        rate?.amountCents != null ? `Rate: ${formatUsd(rate.amountCents)} per day` : ''
      ].filter(Boolean).join(' | ')
    });
    return trip;
      
  },

  async updateTrip(id, patch){
    const trips = store.all(T_TRIPS);
    const i = trips.findIndex(t => t.id === id);
    if (i < 0) throw new Error('Trip not found');
    const current = trips[i];
    const nextStart = patch.startDate ?? current.startDate;
    const nextEnd = patch.endDate ?? current.endDate;
    if (nextStart && nextEnd && nextStart >= nextEnd) {
      throw new Error('End date must be after start date.');
    }
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    store.put(T_TRIPS, next);
    rebalanceCoverage(id);
    const changedEntries = [];
    const tracked = [
      ['title', 'Title'],
      ['startDate', 'Start Date'],
      ['endDate', 'End Date'],
      ['region', 'Region'],
      ['status', 'Status'],
      ['paymentStatus', 'Payment Status'],
      ['rateCents', 'Rate'],
      ['creditsTotalCents', 'Credits']
    ];
    for (const [field, label] of tracked) {
      const before = current[field];
      const after = next[field];
      if (before === after) continue;
      let fromVal = before;
      let toVal = after;
      if (field === 'rateCents' || field === 'creditsTotalCents') {
        fromVal = before == null ? null : formatUsd(before);
        toVal = after == null ? null : formatUsd(after);
      }
      changedEntries.push([label, fromVal, toVal]);
    }
    if (changedEntries.length > 0) {
      const type = changedEntries.some(([label]) => label === 'Status')
        ? 'TRIP_STATUS_UPDATED'
        : changedEntries.some(([label]) => label === 'Payment Status')
        ? 'TRIP_PAYMENT_STATUS_UPDATED'
        : 'TRIP_UPDATED';
      appendEvent({
        trip: next,
        type,
        notes: buildChangeSummary(changedEntries)
      });
    }
    return next;
  },

  async addMembers(tripId, arr){ // [{firstName,lastName,email}]
    const trip = store.byId(T_TRIPS, tripId);
    if (!trip) throw new Error('Trip not found');
    const inserted = arr.map(data =>
      store.insert(T_MEMBERS, { tripId, status: 'IN_PROGRESS', ...data })
    );
    for (const member of inserted) {
      appendEvent({
        trip,
        type: 'MEMBER_ADDED',
        memberId: memberPrimaryId(member),
        notes: `Added ${memberSnapshot(tripId, member, { includeGuardian: true })}`
      });
    }
    return inserted;
  },

  async updateMember(memberId, patch){
    const m = store.byId(T_MEMBERS, memberId);
    if (!m) throw new Error('Member not found');
    const beforeView = canonicalMemberView(m);
    const next = { ...m, ...patch };
    store.put(T_MEMBERS, next);
    rebalanceCoverage(next.tripId);
    const trip = store.byId(T_TRIPS, next.tripId);
    if (trip) {
      const latest = store.byId(T_MEMBERS, memberId) || next;
      const afterView = canonicalMemberView(latest);
      const labels = {
        firstName: 'First Name',
        lastName: 'Last Name',
        email: 'Email',
        phone: 'Phone',
        active: 'Active',
        confirmed: 'Confirmed',
        minor: 'Minor',
        guardianApproved: 'Guardian Approved',
        guardianName: 'Guardian Name',
        guardianEmail: 'Guardian Email',
        guardianPhone: 'Guardian Phone'
      };
      const changeEntries = [];
      for (const [key, label] of Object.entries(labels)) {
        if (beforeView[key] === afterView[key]) continue;
        changeEntries.push([label, beforeView[key], afterView[key]]);
      }
      const pieces = [
        `Updated ${memberSnapshot(trip.id, latest, { includeGuardian: true })}`
      ];
      if (changeEntries.length > 0) {
        pieces.push(`Changes: ${buildChangeSummary(changeEntries)}`);
      }
      appendEvent({
        trip,
        type: 'MEMBER_UPDATED',
        memberId: memberPrimaryId(latest),
        notes: pieces.join(' | ')
      });
    }
    return next;
  },

  async removeMember(memberId){
    const member = store.byId(T_MEMBERS, memberId);
    const trip = member ? store.byId(T_TRIPS, member.tripId) : null;
    const wasCovered = member ? !!getAssignedSpotForMember(member.tripId, memberId) : false;
    const snapshotNote = member ? memberSnapshot(member.tripId, member, { includeGuardian: true }) : '';
    store.remove(T_MEMBERS, memberId);
    if (member) {
      const spot = getAssignedSpotForMember(member.tripId, memberId);
      if (spot) {
        spot.status = 'UNASSIGNED';
        spot.member_id = null;
        spot.released_at = isoNow();
        store.put(T_COVERAGE, spot);
      }
      rebalanceCoverage(member.tripId);
      if (trip) {
        const refreshedTrip = store.byId(T_TRIPS, member.tripId) || trip;
        const pieces = [`Removed ${snapshotNote}`];
        if (wasCovered) pieces.push('Seat returned to pool');
        appendEvent({
          trip: refreshedTrip,
          type: 'MEMBER_REMOVED',
          memberId: memberPrimaryId(member),
          notes: pieces.join(' | ')
        });
      }
    }
    return true;
  },

  // Create spots from money and optionally auto-allocate to pending confirmed
  async applyPayment(tripId, amountCents, { autoAllocate = true } = {}) {
    const trip = store.byId(T_TRIPS, tripId);
    if (!trip) throw new Error('Trip not found');

    // 1) Increase credits
    const before = Number(trip.creditsTotalCents || 0);
    const after = before + Number(amountCents || 0);
    trip.creditsTotalCents = after;
    trip.spot_price_cents = trip.spot_price_cents || computeSpotPriceCents(trip);
    store.put(T_TRIPS, trip);

    const amount = Number(amountCents || 0);
    const noteParts = [];
    noteParts.push(amount === 0
      ? 'No charge — refreshed seat inventory to match existing credits.'
      : `Applied ${formatUsd(amount)}`);
    noteParts.push(`Credits: ${formatUsd(before)} -> ${formatUsd(after)}`);
    appendEvent({
      trip,
      type: 'PAYMENT_APPLIED',
      amountCents: amount,
      creditsBeforeCents: before,
      creditsAfterCents: after,
      notes: noteParts.join(' | ')
    });
    // 2) Create UNASSIGNED spots from purchasable capacity
    const spotPrice = trip.spot_price_cents || 0;
    if (spotPrice <= 0) {
      rebalanceCoverage(tripId);
      return { ok: true, created: 0, autoAllocated: 0, ...summaryForTrip(trip) };
    }

    const spots = getAllocationsByTrip(tripId);
    const assigned = spots.filter(s => s.status === 'ASSIGNED').length;
    const unassigned = spots.filter(s => s.status === 'UNASSIGNED').length;
    const totalSpotsExisting = assigned + unassigned;

    const maxSpotsNow = Math.floor(after / spotPrice);
    const createCount = Math.max(0, maxSpotsNow - totalSpotsExisting);

    for (let i = 0; i < createCount; i++) {
      store.add(T_COVERAGE, {
        spot_id: ulid(),
        trip_id: tripId,
        member_id: null,
        status: 'UNASSIGNED',
        allocated_at: null,
        released_at: null,
        notes: null
      });
    }

    rebalanceCoverage(tripId);

  return { ok: true, created: createCount, autoAllocated: 0, ...summaryForTrip(trip) };
  },

  async syncCoverageInventory(tripId) {
    const trip = store.byId(T_TRIPS, tripId);
    if (!trip) throw new Error('Trip not found');
    rebalanceCoverage(tripId);
    const refreshedTrip = store.byId(T_TRIPS, tripId) || trip;
    return summaryForTrip(refreshedTrip);
  },

  async listMembers(tripId) {
    // uses the same table names as the other helpers
    const trip = store.byId(T_TRIPS, tripId);
    if (!trip) throw new Error('Trip not found');
    return store.all(T_MEMBERS).filter(m => m.tripId === tripId);
  },

  async allocateCoverage(tripId, memberId) {
    const trip = store.byId(T_TRIPS, tripId);
    if (!trip) throw new Error('Trip not found');
    const member = store.byId(T_MEMBERS, memberId);
    if (!member || member.tripId !== tripId) throw new Error('Member not found');

    const sum = summaryForTrip(trip);

    const isMinor = truthy(member.isMinor) || truthy(member.minor) || truthy(member.is_minor);
    const confirmed = truthy(member.confirmed) || truthy(member.is_confirmed) || truthy(member.confirmedAt) || truthy(member.confirmed_at);
    const guardianApproved =
      truthy(member.guardianApproved) ||
      truthy(member.guardian_approved) ||
      truthy(member.guardianApproval) ||
      truthy(member.guardian?.approved);

    if (isMinor && !guardianApproved) throw new Error('Guardian approval required for minors before coverage.');
    if (!isMinor && !confirmed) throw new Error('Adult traveler must be confirmed before coverage.');

    const alreadyCovered = sum.ready_roster.find(r => r.member_id === member.id);
    if (alreadyCovered) return sum;

    const unassigned = getAllocationsByTrip(tripId).find(s => s.status === 'UNASSIGNED');
    if (!unassigned) throw new Error('No unassigned seats available.');

    unassigned.status = 'ASSIGNED';
    unassigned.member_id = member.id;
    unassigned.allocated_at = isoNow();
    store.put(T_COVERAGE, unassigned);

    appendEvent({
      trip,
      type:'COVERAGE_ALLOCATED',
      memberId: member.id,
      notes: `Seat assigned to ${memberSnapshot(tripId, member)}`
    });

    return summaryForTrip(trip);
  },

  async populateDemoContent(options = {}) {
    return runDemoSeed({ force: true, ...options });
  }

};

// Demo helpers (legacy + admin action)
export async function seedDemoIfEmpty() {
  return runDemoSeed({ onlyWhenEmpty: true });
}

export async function populateDemoContent(options = {}) {
  return runDemoSeed({ force: true, ...options });
}

// ===== One-time seeding of coverage spots from existing trips & members =====
export async function seedCoverageIfNeeded(){
  const trips = store.all(T_TRIPS);
  const anySpots = store.all(T_COVERAGE).length > 0;
  if (anySpots) return;

  for (const trip of trips){
    // ensure cached spot price
    trip.spot_price_cents = trip.spot_price_cents || computeSpotPriceCents(trip);
    store.put(T_TRIPS, trip);

    const members = store.all(T_MEMBERS).filter(m => m.tripId === trip.id);
    const eligible = members
      .filter(memberEligible)
      .map(m => ({ m, key: (m.confirmedAt || '9999-12-31') + '|' + (m.lastName||'') + '|' + (m.firstName||'') }))
      .sort((a,b) => a.key.localeCompare(b.key))
      .map(x => x.m);

    // Approximate how many full spots credits can buy (if you track creditsTotalCents)
    const credits = Number(trip.creditsTotalCents || 0);
    const spotPrice = trip.spot_price_cents || 0;
    const maxSpots = spotPrice > 0 ? Math.floor(credits / spotPrice) : 0;

    const assignedNow = eligible.slice(0, maxSpots);
    const unassignedCount = Math.max(0, maxSpots - assignedNow.length);

    // Create ASSIGNED spots
    for (const m of assignedNow){
      const s = {
        spot_id: ulid(),
        trip_id: trip.id,
        member_id: m.id,
        status: 'ASSIGNED',
        allocated_at: isoNow(),
        released_at: null,
        notes: null
      };
      store.add(T_COVERAGE, s);
      appendEvent({
        trip,
        type:'COVERAGE_ALLOCATED',
        memberId: m.id,
        notes: `Auto-seeded coverage for ${memberSnapshot(trip.id, m)}`
      });
    }

    // Create UNASSIGNED spots
    for (let i=0; i<unassignedCount; i++){
      const s = {
        spot_id: ulid(),
        trip_id: trip.id,
        member_id: null,
        status: 'UNASSIGNED',
        allocated_at: null,
        released_at: null,
        notes: null
      };
      store.add(T_COVERAGE, s);
    }
  }
}
// Run once on app start. Safe to call many times; no-ops if already seeded.
export async function initLocalApi() {
  // If you have an existing demo seed, keep it:
  // seedDemoIfEmpty && typeof seedDemoIfEmpty === 'function' && seedDemoIfEmpty();

  // Create coverage spots from current credits & members (no-op if already seeded)
  await seedCoverageIfNeeded();
}
