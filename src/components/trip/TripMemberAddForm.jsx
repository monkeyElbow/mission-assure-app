// src/components/trip/TripMemberAddForm.jsx
import { useState } from 'react'
import { api } from '../../data/api'
import MinorFields from './MinorFields'

// simple US formatter: "(123) 456-7890"
function formatPhone(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
}

export default function TripMemberAddForm({ tripId, onAdded, compact = false, onCancel }) {
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    isMinor: false,
    guardianFirstName: '',
    guardianLastName: '',
    guardianEmail: '',
    guardianPhone: '',
  })
  const [saving, setSaving] = useState(false)

  // field updater for simple inputs + phone mask + switch
  function update(field) {
    return (e) => {
      const val =
        field === 'isMinor'
          ? e.target.checked
          : (field === 'phone' || field === 'guardianPhone')
          ? formatPhone(e.target.value)
          : e.target.value
      setDraft((d) => ({ ...d, [field]: val }))
    }
  }

  // patch helper so MinorFields can set multiple values at once
  function patch(obj) {
    setDraft((d) => {
      const next = { ...d, ...obj }
      if (Object.prototype.hasOwnProperty.call(obj, 'guardianPhone')) {
        next.guardianPhone = formatPhone(obj.guardianPhone)
      }
      return next
    })
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!draft.firstName || !draft.lastName) return alert('First and last name required.')
    if (draft.isMinor && (!draft.guardianFirstName || !draft.guardianLastName)) {
      return alert('Guardian first and last name required for a minor.')
    }

    const guardianFirst = (draft.guardianFirstName || '').trim()
    const guardianLast = (draft.guardianLastName || '').trim()
    const guardianEmail = (draft.guardianEmail || '').trim()
    const guardianPhone = (draft.guardianPhone || '').trim()

    const guardianFull = [guardianFirst, guardianLast].filter(Boolean).join(' ')
    const payload = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      isMinor: draft.isMinor,
      is_minor: draft.isMinor,
      guardianFirst: guardianFirst,
      guardianLast: guardianLast,
      guardian_first_name: guardianFirst,
      guardian_last_name: guardianLast,
      guardianEmail,
      guardian_email: guardianEmail,
      guardianPhone,
      guardian_phone: guardianPhone,
      guardianName: guardianFull,
      guardian: {
        first_name: guardianFirst,
        last_name: guardianLast,
        email: guardianEmail,
        phone: guardianPhone,
        approved: false,
        approved_at: null
      },
      guardianApproved: false,
      guardian_approved: false
    }

    setSaving(true)
    try {
      await api.addMembers(tripId, [payload])
      setDraft({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        isMinor: false,
        guardianFirstName: '',
        guardianLastName: '',
        guardianEmail: '',
        guardianPhone: '',
      })
      onAdded?.()
    } finally {
      setSaving(false)
    }
  }


  function renderForm(buttonArea) {
    return (
      <form onSubmit={handleAdd}>
        {/* Row 1: First / Last */}
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <input
              className="form-control"
              placeholder="First name"
              value={draft.firstName}
              onChange={update('firstName')}
            />
          </div>
          <div className="col-12 col-md-6">
            <input
              className="form-control"
              placeholder="Last name"
              value={draft.lastName}
              onChange={update('lastName')}
            />
          </div>
        </div>

        {/* Row 2: Email / Phone */}
        <div className="row g-2 mt-2">
          <div className="col-12 col-md-7">
            <input
              type="email"
              className="form-control"
              placeholder="Email"
              value={draft.email}
              onChange={update('email')}
              autoComplete="email"
            />
          </div>
          <div className="col-12 col-md-5">
            <input
              className="form-control"
              placeholder="Phone"
              value={draft.phone}
              onChange={update('phone')}
              inputMode="tel"
              autoComplete="tel"
              maxLength={14} // (123) 456-7890
            />
          </div>
        </div>

        {/* Minor toggle */}
        <div className="row g-2 mt-3 mb-1 align-items-center">
          <div className="col">
            <div className="form-check form-switch ms-1">
              <input
                className="form-check-input"
                type="checkbox"
                id="member-isMinor"
                checked={draft.isMinor}
                onChange={update('isMinor')}
                aria-expanded={draft.isMinor}
                aria-controls="minor-fields"
              />
              <label className="form-check-label" htmlFor="member-isMinor">
                Minor (17 or younger)
              </label>
            </div>
          </div>
          {buttonArea}
        </div>

        {/* Animated guardian fields */}
        <MinorFields open={draft.isMinor} values={draft} onChange={patch} />
      </form>
    )
  }

  if (compact) {
    const buttons = (
      <div className="col-auto ms-auto d-flex gap-2">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => {
            setDraft({
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              isMinor: false,
              guardianFirstName: '',
              guardianLastName: '',
              guardianEmail: '',
              guardianPhone: ''
            })
            onCancel?.()
          }}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
    )

    return (
      <div className="card spot-add-form">
        <div className="card-header py-2 d-flex justify-content-between align-items-center">
          <strong className="small">Add Person</strong>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={onCancel}
          />
        </div>
        <div className="card-body">
          {renderForm(buttons)}
        </div>
      </div>
    )
  }

  const defaultButtons = (
    <div className="col-auto ms-auto">
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Adding…' : 'Add Person'}
      </button>
    </div>
  )

  return (
    <div className="card">
      <div className="card-header"><strong>Add Person</strong></div>
      <div className="card-body">
        {renderForm(defaultButtons)}
      </div>
    </div>
  )
}
