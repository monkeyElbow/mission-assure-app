import { useState, useMemo } from 'react'
import Modal from '../shared/Modal'
import { createClaim } from '/src/core/claims'

const INCIDENT_TYPES = [
  'Injury',
  'Illness',
  'Property',
  'Travel Delay',
  'Other'
]

export default function ClaimQuickModal({ open, onClose, onSubmitted, trip, members = [] }) {
  const [memberId, setMemberId] = useState('')
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10))
  const [incidentLocation, setIncidentLocation] = useState('')
  const [incidentType, setIncidentType] = useState(INCIDENT_TYPES[0])
  const [description, setDescription] = useState('')

  const selected = useMemo(
    () => members.find(m => String(m.id ?? m.member_id) === String(memberId)) || null,
    [members, memberId]
  )

  const readyOptions = useMemo(
    () => members.filter(m => {
      const coveredFlag = m.covered
      if (coveredFlag === true || coveredFlag === 1 || coveredFlag === 'true') return true
      if (coveredFlag === false || coveredFlag === 0 || coveredFlag === 'false') return false
      return m.coverage_as_of != null
    }),
    [members]
  )

  function resetForm() {
    setMemberId('')
    setIncidentDate(new Date().toISOString().slice(0, 10))
    setIncidentLocation('')
    setIncidentType(INCIDENT_TYPES[0])
    setDescription('')
  }

  function handleSubmit() {
    if (!selected) { alert('Select a traveler.'); return; }
    if (!incidentDate) { alert('Add the incident date.'); return; }
    if (!description.trim()) { alert('Add a brief description.'); return; }

    const memberFirstName = selected.firstName || selected.first_name || ''
    const memberLastName = selected.lastName || selected.last_name || ''
    const newClaim = createClaim({
      tripId: trip.id,
      tripShortId: trip.shortId,
      tripTitle: trip.title,
      memberId: selected.id ?? selected.member_id,
      memberFirstName,
      memberLastName,
      memberPhone: selected.phone || selected.phone_number || '',
      memberName: `${memberFirstName} ${memberLastName}`.trim() || selected.email || 'Traveler',
      memberEmail: selected.email || '',
      memberTripLeader: !!(selected.tripLeader || selected.trip_leader || selected.is_trip_leader || selected.isTripLeader),
      reporterName: 'Leader',
      reporterEmail: '',
      role: 'LEADER',
      incidentType,
      incidentDate,
      incidentLocation: incidentLocation || (trip.region || ''),
      description: description.trim()
    })

    onSubmitted?.(newClaim)
    resetForm()
    onClose?.('submitted')
  }

  return (
    <Modal
      open={open}
      title="File a Claim"
      onClose={() => {
        resetForm()
        onClose?.()
      }}
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={() => {
            resetForm()
            onClose?.()
          }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Submit Claim</button>
        </>
      }
    >
      <div className="mb-3">
        <label className="form-label">Who is this claim for?</label>
        <select
          className="form-select"
          value={memberId}
          onChange={e => setMemberId(e.target.value)}
        >
          <option value="">— Select covered traveler —</option>
          {readyOptions.map(m => {
            const label =
              `${m.firstName || m.first_name || ''} ${m.lastName || m.last_name || ''}`.trim() ||
              m.email ||
              `Member ${m.id}`
            return (
              <option key={m.id ?? m.member_id} value={m.id ?? m.member_id}>
                {label}
              </option>
            )
          })}
        </select>
      </div>

      <div className="row g-2">
        <div className="col-md-4">
          <label className="form-label">Incident date</label>
          <input
            type="date"
            className="form-control"
            value={incidentDate}
            onChange={e => setIncidentDate(e.target.value)}
          />
        </div>
        <div className="col-md-8">
          <label className="form-label">Incident location</label>
          <input
            className="form-control"
            placeholder="City, State / Country"
            value={incidentLocation}
            onChange={e => setIncidentLocation(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="form-label">Incident type</label>
        <select
          className="form-select"
          value={incidentType}
          onChange={e => setIncidentType(e.target.value)}
        >
          {INCIDENT_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <label className="form-label">What happened?</label>
        <textarea
          className="form-control"
          rows={4}
          placeholder="Provide a short summary for the claims team…"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      <p className="small text-muted mt-3 mb-0">
        You can attach supporting documents from the Claims page after submitting. Need help? Email{' '}
        <a href="mailto:missionassure@agfinancial.org">missionassure@agfinancial.org</a>.
      </p>
    </Modal>
  )
}
