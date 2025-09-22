import { useState, useEffect } from 'react'
import { api } from '../../data/api.local.js'

export default function MemberConfirmModal({ open, onClose, member, onDone }) {
  const [agree, setAgree] = useState(false)
  useEffect(() => { setAgree(false) }, [open])
  if (!open || !member) return null

  async function handleConfirm() {
    if (!agree) return
    await api.updateMember(member.id, { confirmed: true })
    onDone?.(); onClose?.()
  }

  return (
    <div className="modal fade show" style={{display:'block'}} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-lg"><div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">Traveler Confirmation</h5>
          <button className="btn-close" onClick={onClose}></button>
        </div>
        <div className="modal-body">
          <p className="text-muted">This simulates the email the traveler receives.</p>
          <div className="border rounded p-3 bg-light">
            <p>Hi {member.firstName},</p>
            <p>You’ve been added to a Mission Assure trip. Please confirm your participation.</p>
            <div className="form-check mt-3">
              <input id="confirm-check" className="form-check-input" type="checkbox"
                     checked={agree} onChange={e=>setAgree(e.target.checked)} />
              <label className="form-check-label" htmlFor="confirm-check">
                By checking this box, I confirm I am traveling and the information provided is accurate.
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" disabled={!agree} onClick={handleConfirm}>
            Confirm Traveler
          </button>
        </div>
      </div></div>
    </div>
  )
}
