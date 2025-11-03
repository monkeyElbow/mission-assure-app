// /src/core/coverage.js
import { listPayments } from './ledger' 

function daysBetween(aIso, bIso){
  const a = new Date(aIso), b = new Date(bIso)
  const ms = Math.max(0, b.setHours(0,0,0,0) - a.setHours(0,0,0,0))
  return Math.floor(ms / 86400000) + 1
}

export function coverageSummary(trip, members){
  const days = daysBetween(trip.startDate, trip.endDate)
  const seatCost = days * (trip.rateCents || 0)

  // eligible = confirmed + (if minor) guardianApproved
  const eligible = (members || []).filter(m => m.confirmed && (!m.isMinor || m.guardianApproved))

  // total credits recorded for this trip
//   const credits = listPayments(trip.id).reduce((sum,p)=>
//     sum + (p.type==='CHARGE' ? p.amountCents : -p.amountCents), 0)

    const ledgerSum = listPayments(trip.id).reduce((sum,p)=>
        sum + (p.type==='CHARGE' ? p.amountCents : -p.amountCents), 0)
      const credits = Math.max(
        Number(trip?.creditsTotalCents ?? 0),
    Number(ledgerSum || 0)
    )

  const coveredSeats = seatCost > 0 ? Math.max(0, Math.floor(credits / seatCost)) : 0

  // deterministic ordering so PDFs don’t jump around:
  const ordered = eligible
    .map(m => ({...m, _confirmedAt: m.confirmedAt || '9999-12-31'}))
    .sort((a,b)=> a._confirmedAt.localeCompare(b._confirmedAt) || (a.lastName||'').localeCompare(b.lastName||''))

  const covered = ordered.slice(0, coveredSeats)
  return {
    days, seatCost, credits,
    eligibleIds: new Set(eligible.map(m=>m.id)),
    coveredIds:  new Set(covered.map(m=>m.id)),
    eligibleCount: eligible.length,
    coveredCount:  covered.length
  }
}
