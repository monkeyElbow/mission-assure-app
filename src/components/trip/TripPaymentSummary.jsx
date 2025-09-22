import React, { useMemo } from 'react'
import { addPayment, sumCredits } from '../../core/ledger'

function daysBetween(aIso, bIso){
  const a = new Date(aIso), b = new Date(bIso)
  const ms = Math.max(0, b.setHours(0,0,0,0) - a.setHours(0,0,0,0))
  return Math.floor(ms / (1000*60*60*24)) + 1
}

export default function TripPaymentSummary({ trip, members, onPaymentChange, disabled }){
// pick out eligible members only
const eligible = useMemo(
  () => members.filter(m => m.confirmed && (!m.isMinor || m.guardianApproved)),
  [members]
)
const headcount = eligible.length

// keep your days calc
const days = useMemo(
  () => daysBetween(trip.startDate, trip.endDate),
  [trip.startDate, trip.endDate]
)

// compute totals from eligible headcount
const subtotal = useMemo(
  () => days * headcount * (trip.rateCents || 0),
  [days, headcount, trip.rateCents]
)

const credit = useMemo(
  () => sumCredits(trip.id),
  [trip.id, members.length, trip.rateCents, trip.startDate, trip.endDate]
)

const balanceDue = Math.max(0, subtotal - credit)
const tripEnded = new Date(trip.endDate) < new Date()
const refundDue = tripEnded ? Math.max(0, credit - subtotal) : 0


  return (
    <div className={`card ${disabled ? 'opacity-50' : ''}`}>
      <div className="card-header fw-semibold">Payment Summary</div>
      <div className="card-body">
        <div className="row g-2">
          <div className="col-6">Days</div><div className="col-6 text-end">{days}</div>
          <div className="col-6">Headcount</div><div className="col-6 text-end">{headcount}</div>
          <div className="col-6">Rate</div><div className="col-6 text-end">${(trip.rateCents/100).toFixed(2)}/person/day</div>
          <div className="col-12"><hr className="my-2" /></div>
          <div className="col-6 fw-semibold">Subtotal</div><div className="col-6 text-end fw-semibold">${(subtotal/100).toFixed(2)}</div>
          <div className="col-6 text-muted">Credit</div><div className="col-6 text-end text-muted">− ${(credit/100).toFixed(2)}</div>
          {refundDue>0 && <><div className="col-6 text-success">Refund Due*</div><div className="col-6 text-end text-success">${(refundDue/100).toFixed(2)}</div></>}
          <div className="col-12"><hr className="my-2" /></div>
          <div className="col-6 fs-5">Balance</div><div className="col-6 text-end fs-5">${(balanceDue/100).toFixed(2)}</div>
        </div>

        <div className="d-flex gap-2 justify-content-end mt-3">
          {balanceDue>0 && !disabled && (
            <button className="btn btn-primary"
              onClick={()=>{
                addPayment({ tripId: trip.id, amountCents: balanceDue, type:'CHARGE'})
                onPaymentChange?.()
              }}
            >
              Pay Balance (demo)
            </button>
          )}
          {tripEnded && refundDue>0 && (
            <button className="btn btn-outline-secondary" onClick={()=> alert('Refund requested (demo). Admin will review.')}>
              Request Refund
            </button>
          )}
        </div>

        <p className="text-muted small mt-3 mb-0">
          * Refunds may be issued after the trip ends and are subject to administrator approval.
        </p>
      </div>
    </div>
  )
}