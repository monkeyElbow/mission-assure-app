import React, { useState } from 'react'

export default function AdminNotes({ notes=[], onAdd }){
  const [text, setText] = useState('')
  const add = ()=>{
    if(!text.trim()) return
    onAdd?.(text.trim())
    setText('')
  }
  return (
    <div className="card">
      <div className="card-header fw-semibold">Admin Notes</div>
      <div className="card-body">
        <div className="mb-2">
          <textarea className="form-control" rows={3} placeholder="Add a note (visible to admins only)"
            value={text} onChange={e=>setText(e.target.value)}/>
          <div className="text-end mt-2">
            <button className="btn btn-sm btn-primary" onClick={add}>Add Note</button>
          </div>
        </div>
        <ul className="list-unstyled small m-0">
          {notes.map((n,i)=> (
            <li key={i} className="border-top py-2">
              <div>{n.text}</div>
              <div className="text-muted">{new Date(n.createdAt).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}