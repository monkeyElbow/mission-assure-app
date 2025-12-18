// /src/core/coverage.js
import { listPayments } from './ledger' 

function daysBetween(aIso, bIso){
  const a = new Date(aIso), b = new Date(bIso)
  const ms = Math.max(0, b.setHours(0,0,0,0) - a.setHours(0,0,0,0))
  return Math.floor(ms / 86400000) + 1
}

const truthy = (v) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes';
  }
  return Boolean(v);
};

const memberKey = (m) => m?.id ?? m?.member_id ?? m?.memberId ?? m?.member?.id ?? null;

export function coverageSummary(trip = {}, members = []){
  const days = daysBetween(trip.startDate, trip.endDate)
  const seatCost = days * (trip.rateCents || 0)

  const eligible = (members || []).filter(m => {
    const active = m?.active !== false;
    const isMinor = truthy(m?.isMinor ?? m?.minor ?? m?.is_minor);
    const confirmed = truthy(m?.confirmed ?? m?.is_confirmed ?? m?.confirmedAt);
    const guardian = truthy(m?.guardianApproved ?? m?.guardian_approved);
    return active && (isMinor ? guardian : confirmed);
  });

  const ledgerSum = listPayments(trip.id).reduce((sum,p)=>
    sum + (p.type==='CHARGE' ? p.amountCents : -p.amountCents), 0)
  const credits = Math.max(
    Number(trip?.creditsTotalCents ?? 0),
    Number(ledgerSum || 0)
  )

  const coveredSeats = seatCost > 0 ? Math.max(0, Math.floor(credits / seatCost)) : 0

  const ordered = eligible
    .map(m => ({
      member: m,
      key: memberKey(m),
      _confirmedAt: m.confirmedAt || m.updatedAt || '9999-12-31'
    }))
    .filter(entry => entry.key != null)
    .sort((a,b)=> a._confirmedAt.localeCompare(b._confirmedAt) || (a.member.lastName||'').localeCompare(b.member.lastName||''))

  const covered = ordered.slice(0, coveredSeats)
  return {
    days, seatCost, credits,
    eligibleIds: new Set(ordered.map(entry => entry.key)),
    coveredIds:  new Set(covered.map(entry => entry.key)),
    eligibleCount: ordered.length,
    coveredCount:  covered.length
  }
}
