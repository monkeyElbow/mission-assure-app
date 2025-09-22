import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '/src/data/api.local.js'
import MemberConfirmModal from './MemberConfirmModal.jsx'
import GuardianApprovalModal from './GuardianApprovalModal.jsx'

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, when: 'beforeChildren' }
  }
}
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 }
}

export default function TripMembersList({ trip, members = [], onChanged }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [guardianOpen, setGuardianOpen] = useState(false)
  const [activeMember, setActiveMember] = useState(null)
  const [editingId, setEditingId] = useState(null)
  async function handleRemove(memberId) { // NEW
    if (!confirm('Remove this person from the trip?')) return;
    if (typeof api.deleteMember === 'function') {
      await api.deleteMember(memberId);
    } else if (typeof api.removeMember === 'function') {
      await api.removeMember(memberId);
    } else {
      // Fallback: if your API lacks a delete endpoint, wire one up there.
      throw new Error('Missing api.deleteMember / api.removeMember');
    }
    onChanged?.();
  }
  
  const unconfirmedCount = (members || []).filter(m =>
    m.isMinor ? !m.guardianApproved : !m.confirmed
  ).length;
  

  async function handleConfirmClick(member){
    if (member.isMinor) return;
    if (member.confirmed) {
      await api.updateMember?.(member.id, { confirmed: false, confirmedAt: null });
      onChanged?.();
    } else {
      setActiveMember(member);
      setConfirmOpen(true);
    }
  }
  async function handleGuardianClick(member){
    if (!member.isMinor) return;
    if (member.guardianApproved) {
      await api.updateMember?.(member.id, { guardianApproved: false, guardianApprovedAt: null });
      onChanged?.();
    } else {
      setActiveMember(member);
      setGuardianOpen(true);
    }
  }
  
  

  return (
    <div className="card">
      <div className="card-header d-flex align-items-center">
        <strong className="me-2">People on this trip</strong>
        <span className="badge bg-secondary">{members.length}</span>

        {unconfirmedCount > 0 && (
    <span className="badge bg-melon text-light ms-3">
      {unconfirmedCount} not confirmed
    </span>
        )}


      </div>

      <motion.div
        className="list-group list-group-flush"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        {members.length === 0 && (
          <div className="list-group-item text-muted">No people added yet.</div>
        )}
        {members.map(m => (
          <motion.div key={m.id} variants={itemVariants} className="list-group-item">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="me-auto">
                <div className="fw-semibold">{m.firstName} {m.lastName}</div>
                <div className="text-muted small">{m.email}{m.phone ? ` • ${m.phone}` : ''}</div>
                {m.isMinor && (
  <div className="text-muted small">
    Minor{m.guardianName ? ` • Guardian: ${m.guardianName}` : ''}
  </div>
)}
</div> {/* closes the LEFT column */}

{/* RIGHT column: wrap badges in a container */}
<div className="d-flex gap-2 flex-wrap">
{/* Adults: Confirm only */}
{!m.isMinor && (
  <span
    role="button"
    className={`badge ${m.confirmed ? 'bg-agf1' : 'bg-melon'} px-3 py-2`}
    onClick={async () => {
      if (m.confirmed) {
        await api.updateMember(m.id, { confirmed: false, confirmedAt: null });
        onChanged?.();
      } else {
        setActiveMember(m);
        setConfirmOpen(true);
      }
    }}
  >
    {m.confirmed ? 'Confirmed' : 'Confirmation Needed'}
  </span>
)}


{/* Minors: Guardian only */}
{m.isMinor && (
  <span
    role="button"
    className={`badge ${m.guardianApproved ? 'bg-agf1' : 'bg-mango text-dark'} px-3 py-2`}
    onClick={async () => {
      if (m.guardianApproved) {
        await api.updateMember(m.id, { guardianApproved: false, guardianApprovedAt: null });
        onChanged?.();
      } else {
        setActiveMember(m);
        setGuardianOpen(true);
      }
    }}
  >
    {m.guardianApproved ? 'Guardian Approved' : 'Guardian Confirmation Needed'}
  </span>
)}

</div>


{editingId !== m.id && ( 
  <button
    className="btn btn-sm btn-outline-primary"
    onClick={() => setEditingId(editingId === m.id ? null : m.id)}
  >
    Edit
  </button>
)}


              
              {editingId === m.id && (
  <button
    className="btn btn-sm btn-outline-danger"
    onClick={() => handleRemove(m.id)}
  >
    Delete
  </button>
)}
            </div>

            {editingId === m.id && (
              <div className="mt-3 border-top pt-3">
                <MemberInlineEditor
                  member={m}
                  onClose={() => setEditingId(null)}
                  onSaved={() => { setEditingId(null); onChanged?.() }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>

      <MemberConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        member={activeMember}
        onDone={onChanged}
      />
      <GuardianApprovalModal
        open={guardianOpen}
        onClose={() => setGuardianOpen(false)}
        member={activeMember}
        onDone={onChanged}
      />
    </div>
  )
}

function MemberInlineEditor({ member, onClose, onSaved }) {
  function formatPhone(v) {
    const d = (v || '').replace(/\D/g, '').slice(0, 10)
    if (d.length <= 3) return d ? `(${d}` : ''
    if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  }
  const [form, setForm] = useState({
    firstName: member.firstName || '',
    lastName: member.lastName || '',
    email: member.email || '',
    phone: member.phone || '',
    isMinor: !!member.isMinor,
    guardianName: member.guardianName || '',
    guardianEmail: member.guardianEmail || ''
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await api.updateMember(member.id, form)
    setSaving(false)
    onSaved?.()
  }

  return (
    <div className="row g-2">
      <div className="col-12 col-md-4">
        <label className="form-label small">First name</label>
        <input className="form-control"
          value={form.firstName}
          onChange={e=>setForm(f=>({ ...f, firstName: e.target.value }))}
        />
      </div>
      <div className="col-12 col-md-4">
        <label className="form-label small">Last name</label>
        <input className="form-control"
          value={form.lastName}
          onChange={e=>setForm(f=>({ ...f, lastName: e.target.value }))}
        />
      </div>
      <div className="col-12 col-md-4">
        <label className="form-label small">Phone</label>
        <input className="form-control"
          value={form.phone}
          onChange={e=>setForm(f=>({ ...f, phone: formatPhone(e.target.value) }))}
        />
      </div>
      <div className="col-12 col-md-6">
        <label className="form-label small">Email</label>
        <input className="form-control"
          value={form.email}
          onChange={e=>setForm(f=>({ ...f, email: e.target.value }))}
        />
      </div>
      <div className="col-12 col-md-3 d-flex align-items-end">
        <div className="form-check">
          <input
            id={`minor-${member.id}`}
            type="checkbox"
            className="form-check-input"
            checked={form.isMinor}
            onChange={e=>setForm(f=>({ ...f, isMinor: e.target.checked }))}
          />
          <label className="form-check-label" htmlFor={`minor-${member.id}`}>Minor</label>
        </div>
      </div>
      {form.isMinor && (
        <>
          <div className="col-12 col-md-4">
            <label className="form-label small">Guardian Name</label>
            <input className="form-control"
              value={form.guardianName}
              onChange={e=>setForm(f=>({ ...f, guardianName: e.target.value }))}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Guardian Email</label>
            <input className="form-control"
              value={form.guardianEmail}
              onChange={e=>setForm(f=>({ ...f, guardianEmail: e.target.value }))}
            />
          </div>
        </>
      )}
      <div className="col-12 d-flex gap-2 mt-2">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
