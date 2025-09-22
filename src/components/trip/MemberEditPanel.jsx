import React, { useState } from 'react'

export default function MemberEditPanel({ member, onUpdate }){
  const [form, setForm] = useState({
    firstName: member.firstName||'',
    lastName: member.lastName||'',
    email: member.email||'',
    phone: member.phone||'',
    type: member.type||'ADULT',
    guardianName: member.guardianName||'',
    guardianEmail: member.guardianEmail||'',
    guardianPhone: member.guardianPhone||'',
  })

  const save = ()=> onUpdate(member.id, form)

  return (
    <div className="border rounded p-2">
      <div className="row g-2">
        <div className="col-6 col-md-3">
          <label className="form-label">First</label>
          <input className="form-control form-control-sm" value={form.firstName} onChange={e=>setForm(f=>({...f, firstName:e.target.value}))}/>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label">Last</label>
          <input className="form-control form-control-sm" value={form.lastName} onChange={e=>setForm(f=>({...f, lastName:e.target.value}))}/>
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label">Email</label>
          <input className="form-control form-control-sm" type="email" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))}/>
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label">Phone</label>
          <input className="form-control form-control-sm" value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))}/>
        </div>

        <div className="col-12">
          <div className="btn-group" role="group" aria-label="Type">
            <input type="radio" className="btn-check" name={`type-${member.id}`} id={`t-adult-${member.id}`} checked={form.type==='ADULT'} onChange={()=>setForm(f=>({...f,type:'ADULT'}))}/>
            <label className="btn btn-outline-secondary btn-sm" htmlFor={`t-adult-${member.id}`}>Adult</label>
            <input type="radio" className="btn-check" name={`type-${member.id}`} id={`t-minor-${member.id}`} checked={form.type==='MINOR'} onChange={()=>setForm(f=>({...f,type:'MINOR'}))}/>
            <label className="btn btn-outline-secondary btn-sm" htmlFor={`t-minor-${member.id}`}>Minor</label>
          </div>
        </div>

        {form.type==='MINOR' && (
          <>
            <div className="col-12 col-md-4">
              <label className="form-label">Guardian Name</label>
              <input className="form-control form-control-sm" value={form.guardianName} onChange={e=>setForm(f=>({...f, guardianName:e.target.value}))}/>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Guardian Email</label>
              <input className="form-control form-control-sm" type="email" value={form.guardianEmail} onChange={e=>setForm(f=>({...f, guardianEmail:e.target.value}))}/>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Guardian Phone</label>
              <input className="form-control form-control-sm" value={form.guardianPhone} onChange={e=>setForm(f=>({...f, guardianPhone:e.target.value}))}/>
            </div>
          </>
        )}
      </div>
      <div className="text-end mt-2">
        <button className="btn btn-sm btn-primary" onClick={save}>Save Person</button>
      </div>
    </div>
  )
}