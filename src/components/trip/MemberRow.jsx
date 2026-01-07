import React, { useState } from 'react'
import MemberEditPanel from './MemberEditPanel'
import Modal from '../shared/Modal'

export default function MemberRow({ member, onUpdate, onRemove }){
  const [open, setOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showGuardian, setShowGuardian] = useState(false)

  const ConfirmEmailMock = () => (
    <div>
      <p>Hello {member.firstName},</p>
      <p>Your leader has included you on a trip covered by Mission Assure insurance.</p>
      <p>
        By checking the box below, you affirm that the information provided is accurate and you consent to participate.
      </p>
      <div className="form-check my-3">
        <input className="form-check-input" type="checkbox" id={`mem-consent-${member.id}`} onChange={(e)=>{
          if(e.target.checked){
            onUpdate(member.id, { status: { ...member.status, confirmed: true }, confirmedAt: new Date().toISOString() })
            setShowConfirm(false)
          }
        }} />
        <label className="form-check-label" htmlFor={`mem-consent-${member.id}`}>
          I agree — by clicking here, I am stating that I consent and the information is correct.
        </label>
      </div>
    </div>
  )

  const GuardianEmailMock = () => (
    <div>
      <p>Dear {member.guardianName||'Parent/Guardian'},</p>
      <p>
        {member.firstName} has been included on a trip covered by Mission Assure insurance.
        Please provide consent for this minor to participate.
      </p>
      <div className="form-check my-3">
        <input className="form-check-input" type="checkbox" id={`g-consent-${member.id}`} onChange={(e)=>{
          if(e.target.checked){
            onUpdate(member.id, { status: { ...member.status, guardianApproved: true }, guardianApprovedAt: new Date().toISOString() })
            setShowGuardian(false)
          }
        }} />
        <label className="form-check-label" htmlFor={`g-consent-${member.id}`}>
          I agree — by clicking here, I am stating that I am the legal guardian and I consent.
        </label>
      </div>
      <p className="small text-muted m-0">Questions? Call 866-890-0156.</p>
    </div>
  )

  return (
    <div className="list-group-item">
      <div className="d-flex align-items-center gap-2">
        <div className="fw-semibold">{member.firstName} {member.lastName}</div>
        <div className="text-muted small">{member.email}</div>
        <div className="ms-auto d-flex gap-2">
          <span className={`badge ${member.status?.confirmed ? 'bg-agf2 text-white' : 'bg-melon'}`}
                role="button"
                onClick={()=> setShowConfirm(true)}>
            {member.status?.confirmed ? 'Confirmed' : 'Unconfirmed'}
          </span>
          {member.type==='MINOR' && (
            <span className={`badge ${member.status?.guardianApproved ? 'bg-agf2 text-white' : 'bg-mango'}`}
                  role="button"
                  onClick={()=> setShowGuardian(true)}>
              {member.status?.guardianApproved ? 'Guardian Approved' : 'Guardian Needed'}
            </span>
          )}
          <button className="btn btn-sm btn-outline-secondary" onClick={()=> setOpen(v=>!v)}>{open? 'Close' : 'Edit'}</button>
          <button className="btn btn-sm btn-outline-danger" onClick={()=> onRemove(member.id)}>Remove</button>
        </div>
      </div>

      {open && (
        <div className="mt-2">
          <MemberEditPanel member={member} onUpdate={onUpdate} />
        </div>
      )}

      <Modal open={showConfirm} title="Member Confirmation" onClose={()=> setShowConfirm(false)} footer={null}>
        <ConfirmEmailMock />
      </Modal>
      <Modal open={showGuardian} title="Guardian Consent" onClose={()=> setShowGuardian(false)} footer={null}>
        <GuardianEmailMock />
      </Modal>
    </div>
  )
}
