import React, { useEffect } from 'react'

export default function Modal({ open, title, children, footer, onClose }){
  useEffect(()=>{
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return ()=>{ document.body.style.overflow = '' }
  },[open])

  if(!open) return null
  return (
    <div className="ma-modal-backdrop" onClick={onClose}>
      <div className="ma-modal" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="ma-modal-header">
          <h5 className="m-0">{title}</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>×</button>
        </div>
        <div className="ma-modal-body">{children}</div>
        {footer && <div className="ma-modal-footer d-flex gap-2 justify-content-end">{footer}</div>}
      </div>
      <style>{`
        .ma-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1050}
        .ma-modal{background:#fff;border-radius:12px;max-width:640px;width:92vw;box-shadow:0 20px 80px rgba(0,0,0,.25)}
        .ma-modal-header,.ma-modal-footer{padding:12px 16px;border-bottom:1px solid #eee}
        .ma-modal-footer{border-top:1px solid #eee;border-bottom:none}
        .ma-modal-body{padding:16px}
      `}</style>
    </div>
  )
}