import { useState, useEffect } from 'react'
import { api } from '../../data/api.local.js'

export default function GuardianApprovalModal({ open, onClose, member, onDone }) {
  const [agree, setAgree] = useState(false)
  useEffect(() => { setAgree(false) }, [open])
  if (!open || !member) return null

  async function handleApprove() {
    if (!agree) return
    await api.updateMember(member.id, { guardianApproved: true })
    onDone?.(); onClose?.()
  }

  return (
    <div className="modal fade show" style={{display:'block'}} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-lg"><div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">Parental / Guardian Consent</h5>
          <button className="btn-close" onClick={onClose}></button>
        </div>
        <div className="modal-body">
          <p className="text-muted">This simulates the email the guardian receives.</p>
          <div className="border rounded p-3 bg-light">
            <p>Dear {member.guardianName || 'Parent/Guardian'},</p>
            <p>{member.firstName} has been listed as a minor traveler. Please consent to their participation.</p>
            <div className="form-check mt-3">
              <input id="guardian-check" className="form-check-input" type="checkbox"
                     checked={agree} onChange={e=>setAgree(e.target.checked)} />
              <label className="form-check-label" htmlFor="guardian-check">
                By checking this box, I confirm I am the legal guardian and consent to {member.firstName}’s participation.
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" disabled={!agree} onClick={handleApprove}>
            Approve as Guardian
          </button>
        </div>
      </div></div>
    </div>
  )
}
