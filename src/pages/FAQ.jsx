import React from 'react'

export default function FAQ(){
  return (
    <div className="container py-4">
      <h1 className="mb-3">FAQ</h1>
      <h5>Domestic vs International</h5>
      <p>Switching from Domestic to International (or vice versa) may change form requirements. Confirmations reset to ensure everyone acknowledges the new trip scope.</p>
      <h5>Credits & Payments</h5>
      <p>You can pay in multiple transactions. Your credit is applied against the trip’s subtotal (days × people × rate). If the subtotal increases, you’ll see a balance due. If the subtotal decreases, any overpayment becomes refundable after the trip ends.</p>
      <h5>Refunds</h5>
      <p>Refunds may be issued if the number of insured participants decreases or a trip scope changes after payment. Refunds are reviewed by an administrator and will only be processed once the trip has officially ended. Once approved, refunds are credited back to the original payment method.</p>
      <h5>Archive</h5>
      <p>Trips automatically archive at the end date. Archived trips are read-only; you can still report a claim.</p>
      <h5>Help</h5>
      <p>Questions? Call <strong>866-890-0156</strong>. Fallback PDF forms are available upon request if digital flows are unavailable.</p>
    </div>
  )
}