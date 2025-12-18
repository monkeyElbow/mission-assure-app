import React from 'react'
import AdminTripRow from './AdminTripRow'

export default function AdminTripTable({ trips, onArchiveToggle, onSelectTrip }){
  return (
    <div className="card">
      <div className="card-header fw-semibold">All Trips</div>
      <div className="table-responsive">
        <table className="table table-sm mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th>Trip</th>
              <th>Leader</th>
              <th>Dates</th>
              <th>Status</th>
              <th>Payment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trips.map(t => (
              <AdminTripRow key={t.id} trip={t} onArchiveToggle={onArchiveToggle} onSelectTrip={onSelectTrip}/>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
