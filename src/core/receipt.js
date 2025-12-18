import { coverageSummary } from './coverage.js'
import { daysInclusive } from './pricing.js'

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString() : '')
const fmtDateTime = (d) => new Date(d).toLocaleString()

const memberIdKey = (m) => m?.id ?? m?.member_id ?? m?.memberId ?? m?.member?.id ?? null

const formatMemberName = (m) => {
  const first = m?.firstName ?? m?.first_name ?? ''
  const last = m?.lastName ?? m?.last_name ?? ''
  const combined = `${first} ${last}`.trim()
  if (combined) return combined
  if (m?.email) return m.email
  const id = memberIdKey(m)
  return id ? `Member ${id}` : 'Traveler'
}

const currency = (n = 0) =>
  (Number(n) / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })

const escapeHtml = (s = '') =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

export function buildReceiptSnapshot(trip, { paymentCents = null, paidAt = null } = {}) {
  const members = Array.isArray(trip?.members) ? trip.members : []
  const cov = coverageSummary(trip, members)

  const memberKeySet = cov.coveredIds
  const coveredMembers = members.filter(m => memberKeySet.has(memberIdKey(m)))
  const notCoveredMembers = members.filter(m => !memberKeySet.has(memberIdKey(m)))
  const coveredNames = coveredMembers.map(formatMemberName)
  const notCoveredNames = notCoveredMembers.map(m => {
    const reasonParts = []
    const confirmed = !!(m?.confirmed || m?.is_confirmed || m?.confirmedAt)
    const guardian = !!(m?.guardianApproved || m?.guardian_approved)
    const active = m?.active !== false
    if (!active) reasonParts.push('Standby')
    else if (!confirmed) reasonParts.push('Not confirmed')
    if ((m?.isMinor || m?.minor || m?.is_minor) && !guardian) reasonParts.push('No guardian approval')
    const label = reasonParts.length ? ` (${reasonParts.join(', ')})` : ''
    return `${formatMemberName(m)}${label}`
  })

  const days = daysInclusive(trip?.startDate, trip?.endDate)
  const subtotalCents = (trip?.rateCents || 0) * days * coveredMembers.length
  const creditsCents = trip?.creditsTotalCents ?? 0
  const balanceDue = Math.max(0, subtotalCents - creditsCents)
  const refundEligibleCents = Math.max(0, creditsCents - subtotalCents)

  return {
    tripId: trip?.shortId || trip?.id,
    title: trip?.title || 'Mission Assure Trip',
    region: trip?.region === 'INTERNATIONAL' ? 'International' : 'Domestic',
    startDate: trip?.startDate,
    endDate: trip?.endDate,
    membersCount: members.length,
    coveredCount: coveredNames.length,
    coveredNames,
    notCoveredNames,
    subtotalCents,
    creditsCents,
    balanceDue,
    refundEligibleCents,
    paymentCents,
    totalPaidToDateCents: creditsCents,
    generatedAt: new Date(),
    paidAt: paidAt || null
  }
}

export function renderReceiptHTML(snap) {
  const period = (snap.startDate || snap.endDate)
    ? `${fmtDate(snap.startDate)} – ${fmtDate(snap.endDate)}`
    : 'Dates TBA'

  const paidState = snap.balanceDue === 0
    ? `Paid in full as of ${fmtDateTime(snap.generatedAt)}`
    : `Partial payment on file as of ${fmtDateTime(snap.generatedAt)}`

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
      <div class="row"><span class="muted">Subtotal</span><span>${currency(snap.subtotalCents)}</span></div>
      <div class="row"><span class="muted">Credits applied</span><span>- ${currency(snap.creditsCents)}</span></div>
      <div class="hr"></div>
      <div class="row"><span><strong>Balance due</strong></span><span><strong>${currency(snap.balanceDue)}</strong></span></div>
      <div class="paid-box">
        <svg class="check" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
        <div>
          <div><strong>${paidState}</strong></div>
          <div class="row"><span class="muted">Total paid to date</span><span>${currency(snap.totalPaidToDateCents)}</span></div>
          ${
            snap.paymentCents != null
              ? `<div class="row"><span class="muted">Payment today</span><span>${currency(snap.paymentCents)}</span></div>`
              : ''
          }
          ${
            snap.refundEligibleCents > 0
              ? `<div class="row"><span class="muted">Unused credit</span><span>${currency(snap.refundEligibleCents)}</span></div>
                 <div class="small muted">Eligible for refund once the trip has started.</div>`
              : ''
          }
        </div>
      </div>
    </div>

    <div class="card">
      <div><strong>Receipt details</strong></div>
      <div class="row"><span class="muted">Generated</span><span>${fmtDateTime(snap.generatedAt)}</span></div>
      <div class="row"><span class="muted">Trip ID</span><span class="mono">${escapeHtml(String(snap.tripId || ""))}</span></div>
      <div class="row"><span class="muted">Region</span><span>${escapeHtml(snap.region)}</span></div>
      <div class="row"><span class="muted">Participants (covered)</span><span>${snap.coveredCount}</span></div>
    </div>
  </div>

  <div class="card" style="margin-top:16px;">
    <div>
      <strong>${
        (snap.notCoveredMembers && snap.notCoveredMembers.length > 0)
          ? 'Participants at time of receipt'
          : 'All participants covered at time of receipt'
      }</strong>
    </div>

    <div style="margin-top:8px;">
      <div class="small muted">COVERED (confirmed &amp; paid)</div>
      <ul style="margin:6px 0 10px 18px;">
        ${
          (snap.coveredNames && snap.coveredNames.length > 0)
            ? snap.coveredNames.map(name => `<li>${escapeHtml(name)}</li>`).join('')
            : '<li>None</li>'
        }
      </ul>
    </div>

    ${
      (snap.notCoveredNames && snap.notCoveredNames.length > 0) ? `
    <div style="margin-top:12px;">
      <div class="small muted" style="color:#B00020;">
        <strong>NOT COVERED on this receipt</strong>
      </div>
      <ul style="margin:6px 0 0 18px;">
        ${
          snap.notCoveredNames
            .map(name => `<li>${escapeHtml(name)}</li>`)
            .join('')
        }
      </ul>
      <div class="small" style="margin-top:8px; color:#B00020;">
        Legal notice: Individuals listed as “Not covered” are not insured under this receipt as of the time shown.
        Coverage requires confirmation (and guardian approval for minors) plus sufficient payment before departure.
      </div>
    </div>
    ` : ''
    }
  </div>


  <div class="legal">
    <strong>Important:</strong> This receipt confirms payment recorded as of ${fmtDateTime(snap.generatedAt)}.
    Coverage applies to the participants on this receipt as of this date and time.
    Add more people? Sign in at <span class="mono">missionassure.agfinancial.org</span> to purchase additional coverage before departure.
  </div>
</body>
</html>`;
}
