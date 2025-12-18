import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../data/api'
import InlineNotice from '../components/InlineNotice.jsx'

export default function TripNew(){
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [startDate, setStart] = useState('');
  const [endDate, setEnd] = useState('');
  const [region, setRegion] = useState('DOMESTIC');
  const [err, setErr] = useState('');

  async function submit(e){
    e.preventDefault();
    setErr('');
    if(!title || !startDate || !endDate){ setErr('Please fill all fields.'); return; }
    if (startDate >= endDate) {
      setErr('End date must be after start date.');
      return;
    }
    try{
      const trip = await api.createTrip({ title, startDate, endDate, region });
      nav(`/trips/${trip.id}`);
    }catch(ex){ setErr(ex.message || 'Failed to create trip'); }
  }

  return (
    <div className="container my-3" style={{maxWidth: 720}}>
      <div className="card p-4 shadow-sm" style={{ borderRadius: 14 }}>
        <h1 className="h3 mb-3">New Trip</h1>
        {err && (
          <InlineNotice tone="danger" dismissible timeoutMs={5000} className="mb-3">
            {err}
          </InlineNotice>
        )}
        <form onSubmit={submit} className="row g-3">
          <div className="col-12">
            <label className="form-label">Title</label>
            <input className="form-control" value={title} onChange={e=>setTitle(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Start date</label>
            <input type="date" className="form-control" value={startDate} onChange={e=>setStart(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">End date</label>
            <input type="date" className="form-control" value={endDate} onChange={e=>setEnd(e.target.value)} />
          </div>
          <div className="col-12">
            <label className="form-label me-3">Region</label>
            <div className="form-check form-check-inline">
              <input className="form-check-input" type="radio" id="reg-dom" name="region" value="DOMESTIC" checked={region==='DOMESTIC'} onChange={()=>setRegion('DOMESTIC')} />
              <label className="form-check-label" htmlFor="reg-dom">Domestic</label>
            </div>
            <div className="form-check form-check-inline">
              <input className="form-check-input" type="radio" id="reg-for" name="region" value="INTERNATIONAL" checked={region==='INTERNATIONAL'} onChange={()=>setRegion('INTERNATIONAL')} />
              <label className="form-check-label" htmlFor="reg-for">International</label>
            </div>
          </div>
          <div className="col-12 d-flex gap-2">
            <button className="btn btn-primary" type="submit">Create Trip</button>
          </div>
        </form>
      </div>
    </div>
  )
}
