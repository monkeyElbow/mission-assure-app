import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../src/core/storage.js'
import { api } from '../src/data/api.local.js'
import { coverageSummary } from '../src/core/coverage.js'
import { buildReceiptSnapshot, renderReceiptHTML } from '../src/core/receipt.js'
import {
  createClaim as createClaimRecord,
  updateClaim as updateClaimRecord,
  addClaimNote,
  addClaimMessage
} from '../src/core/claims.js'

function isoDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

async function createBaseTrip() {
  const start = isoDate(7)
  const end = isoDate(14)
  return api.createTrip({
    title: 'Test Trip',
    startDate: start,
    endDate: end,
    region: 'DOMESTIC'
  })
}

beforeEach(() => {
  store.clearAll()
})

describe('coverage/payments flows', () => {
  it('allocates a seat after payment for a confirmed traveler', async () => {
    const trip = await createBaseTrip()
    const [member] = await api.addMembers(trip.id, [{
      firstName: 'Ana',
      lastName: 'Ray',
      email: 'ana@example.com'
    }])

    await api.updateMember(member.id, { confirmed: true, isMinor: false })

    let summary = await api.getRosterSummary(trip.id)
    expect(summary.covered_count).toBe(0)
    expect(summary.pending_count).toBe(1)

    const seatCost = summary.spot_price_cents
    expect(seatCost).toBeGreaterThan(0)

    await api.applyPayment(trip.id, seatCost)

    summary = await api.getRosterSummary(trip.id)
    expect(summary.covered_count).toBe(1)
    expect(summary.pending_count).toBe(0)
    expect(summary.unassigned_spots).toBe(1)
  })

  it('removing a covered traveler releases the seat', async () => {
    const trip = await createBaseTrip()
    const [member] = await api.addMembers(trip.id, [{
      firstName: 'Ben',
      lastName: 'Lee',
      email: 'ben@example.com'
    }])
    await api.updateMember(member.id, { confirmed: true, isMinor: false })

    const { spot_price_cents: seatCost } = await api.getRosterSummary(trip.id)
    await api.applyPayment(trip.id, seatCost)

    await api.removeMember(member.id)

    const summary = await api.getRosterSummary(trip.id)
    expect(summary.covered_count).toBe(0)
    expect(summary.unassigned_spots).toBe(0)
  })

  it('history records key events in order', async () => {
    const trip = await createBaseTrip()
    const [member] = await api.addMembers(trip.id, [{
      firstName: 'Chris',
      lastName: 'Doe',
      email: 'chris@example.com'
    }])
    await api.updateMember(member.id, { confirmed: true, isMinor: false })
    const { spot_price_cents: seatCost } = await api.getRosterSummary(trip.id)
    await api.applyPayment(trip.id, seatCost)

    const history = await api.getTripHistory(trip.id)
    const types = history.events.map(evt => evt.type)

    expect(types).toContain('MEMBER_ADDED')
    expect(types).toContain('MEMBER_UPDATED')
    expect(types).toContain('PAYMENT_APPLIED')
    expect(types).toContain('COVERAGE_ALLOCATED')
  })

  it('history covers trip lifecycle actions', async () => {
    const trip = await createBaseTrip()

    await api.updateTrip(trip.id, { title: 'Updated Trip Title' })
    await api.updateTrip(trip.id, { paymentStatus: 'PAID' })
    await api.updateTrip(trip.id, { status: 'ARCHIVED' })

    const [m1, m2] = await api.addMembers(trip.id, [{
      firstName: 'Alex',
      lastName: 'Hart',
      email: 'alex@example.com'
    }, {
      firstName: 'Jordan',
      lastName: 'Miles',
      email: 'jordan@example.com'
    }])

    await api.updateMember(m1.id, { confirmed: true, isMinor: false })
    await api.updateMember(m2.id, { confirmed: true, isMinor: false })

    const { spot_price_cents: seatCost } = await api.getRosterSummary(trip.id)
    await api.applyPayment(trip.id, seatCost * 2)

    await api.allocateCoverage(trip.id, m1.id)
    await api.releaseCoverage(trip.id, m1.id, { reason: 'Test release' })
    await api.allocateCoverage(trip.id, m1.id)
    await api.transferCoverage(trip.id, m1.id, m2.id)
    await api.removeMember(m1.id)

    await api.createClaim({
      trip_id: trip.id,
      member_id: m2.id,
      incident_type: 'Illness',
      description: 'Test incident',
      incident_date: trip.startDate,
      incident_location: 'Site'
    })

    const claimRow = createClaimRecord({
      tripId: trip.id,
      tripTitle: trip.title,
      memberId: m2.id,
      memberFirstName: 'Jordan',
      memberLastName: 'Miles',
      memberEmail: 'jordan@example.com',
      reporterName: 'Leader'
    })
    updateClaimRecord(claimRow.id, { status: 'IN_REVIEW' })
    addClaimNote(claimRow.id, 'Admin', 'Follow-up note')
    addClaimMessage(claimRow.id, { authorRole: 'ADMIN', authorName: 'Admin', text: 'Message to leader' })

    const history = await api.getTripHistory(trip.id)
    const types = history.events.map(evt => evt.type)

    expect(types).toContain('TRIP_CREATED')
    expect(types).toContain('TRIP_UPDATED')
    expect(types).toContain('TRIP_PAYMENT_STATUS_UPDATED')
    expect(types).toContain('TRIP_STATUS_UPDATED')
    expect(types).toContain('MEMBER_ADDED')
    expect(types).toContain('MEMBER_UPDATED')
    expect(types).toContain('MEMBER_REMOVED')
    expect(types).toContain('PAYMENT_APPLIED')
    expect(types).toContain('COVERAGE_ALLOCATED')
    expect(types).toContain('COVERAGE_RELEASED')
    expect(types).toContain('COVERAGE_TRANSFERRED')
    expect(types).toContain('CLAIM_SUBMITTED')
    expect(types).toContain('CLAIM_CREATED')
    expect(types).toContain('CLAIM_STATUS_UPDATED')
    expect(types).toContain('CLAIM_NOTE_ADDED')
    expect(types).toContain('CLAIM_MESSAGE_ADDED')
  })
})

describe('receipt + coverage helpers', () => {
  it('coverageSummary handles member_id identifiers', () => {
    const trip = {
      id: 'trip-1',
      startDate: '2025-01-01',
      endDate: '2025-01-03',
      rateCents: 1000,
      creditsTotalCents: 6000
    }
    const members = [
      { member_id: 'm-1', confirmed: true, isMinor: false, firstName: 'Ready', lastName: 'One' },
      { member_id: 'm-2', confirmed: false, isMinor: false, firstName: 'Pending', lastName: 'Two' }
    ]
    const summary = coverageSummary(trip, members)
    expect(summary.coveredCount).toBe(1)
    expect(summary.coveredIds.has('m-1')).toBe(true)
  })

  it('receipt snapshot lists covered and not-covered names', () => {
    const trip = {
      id: 'trip-2',
      shortId: 'TRP-2',
      title: 'Receipt Trip',
      region: 'DOMESTIC',
      startDate: '2025-02-01',
      endDate: '2025-02-04',
      rateCents: 1500,
      creditsTotalCents: 12000,
      members: [
        { member_id: 'a1', confirmed: true, isMinor: false, firstName: 'Covered', lastName: 'Traveler' },
        { member_id: 'b2', confirmed: false, isMinor: false, firstName: 'Pending', lastName: 'Guest' }
      ]
    }
    const snap = buildReceiptSnapshot(trip)
    expect(snap.coveredNames).toContain('Covered Traveler')
    expect(snap.notCoveredNames.some(name => name.includes('Pending Guest'))).toBe(true)
    const html = renderReceiptHTML(snap)
    expect(html).toMatch(/Covered Traveler/)
    expect(html).toMatch(/Pending Guest/)
    expect(html).toMatch(/Unused credit/)
  })
})
