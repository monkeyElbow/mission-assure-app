// src/components/trip/TripMemberAddForm.jsx
import { useState } from 'react'
import { api } from '../../data/api'

// simple US formatter: "(123) 456-7890"
function formatPhone(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
}

export default function TripMemberAddForm({ tripId, onAdded }) {
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    isMinor: false,
    guardianName: '',       // NEW
    guardianEmail: '',      // NEW
    guardianPhone: '',      // NEW
  })
  const [saving, setSaving] = useState(false)

  function update(field){
    return (e) => {
      const val =
        field === 'isMinor' ? e.target.checked :
        (field === 'phone' || field === 'guardianPhone') ? formatPhone(e.target.value) :
        e.target.value
      setDraft(d => ({ ...d, [field]: val }))
    }
  }

  async function handleAdd(e){
    e.preventDefault()
    if (!draft.firstName || !draft.lastName) return alert('First and last name required.')
    if (draft.isMinor && !draft.guardianName) return alert('Guardian name required for a minor.')
    setSaving(true)
    try{
      await api.addMembers(tripId, [draft])
      setDraft({
        firstName:'', lastName:'', email:'', phone:'',
        isMinor:false,
        guardianName:'', guardianEmail:'', guardianPhone:''
      })
      onAdded?.()
    } finally{
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header"><strong>Add Person</strong></div>
      <div className="card-body">
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
                maxLength={14}  // (123) 456-7890
              />
            </div>
          </div>


          {/* Row 4: Guardian fields (show immediately when Minor is on) */}
          {draft.isMinor && (
            <div className="row g-2 mt-4">
              <div className="col-12 col-md-4">
                <label className="form-label small">Guardian Name</label>
                <input
                  className="form-control"
                  placeholder="Parent/Guardian name"
                  value={draft.guardianName}
                  onChange={update('guardianName')}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small">Guardian Email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="guardian@example.com"
                  value={draft.guardianEmail}
                  onChange={update('guardianEmail')}
                  autoComplete="email"
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small">Guardian Phone</label>
                <input
                  className="form-control"
                  placeholder="Phone"
                  value={draft.guardianPhone}
                  onChange={update('guardianPhone')}
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={14}
                />
              </div>
            </div>
          )}
          {/* Row 3: Minor toggle + submit */}
          <div className="row g-2 mt-3 mb-1 align-items-center">
            <div className="col">
              <div className="form-check form-switch ms-1">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="member-isMinor"
                  checked={draft.isMinor}
                  onChange={update('isMinor')}
                />
                <label className="form-check-label" htmlFor="member-isMinor">
                  Minor (17 or younger)
                </label>
              </div>
            </div>
            <div className="col-auto ms-auto">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Adding…' : 'Add Person'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
