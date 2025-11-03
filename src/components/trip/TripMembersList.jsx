import React from 'react'

export default function TripMembersList({
  ready = [],
  pending = [],
  overviewReady = ready,
  overviewPending = pending,
  coveredCount = 0,
  pendingCount = 0,
  unassignedSpots = 0,
  spotAddOpen = false,
  onSpotAddToggle = () => {},
  spotAddForm = null,
  rosterError = null,
  searchTerm = '',
  onSearchTermChange = () => {},
  searchActive = false,
  onMemberFocus,
  renderReadyItem,
  renderPendingItem
}) {
  const renderReady = renderReadyItem || (() => null);
  const renderPending = renderPendingItem || (() => null);
  const totalMatches = ready.length + pending.length;
  const readyMatchIds = new Set(ready.map((m) => String(m.member_id ?? m.id ?? '')));
  const pendingMatchIds = new Set(pending.map((m) => String(m.member_id ?? m.id ?? '')));
  const searchLabel = searchTerm.trim();

  const handleSearchInput = (event) => onSearchTermChange?.(event.target.value);
  const clearSearch = () => onSearchTermChange?.('');

  const labelForMember = (member) => {
    const first = member.first_name || member.firstName || '';
    const last = member.last_name || member.lastName || '';
    const full = `${first} ${last}`.trim();
    if (full) return full;
    if (member.email) return member.email.trim();
    return `Member ${member.member_id ?? member.id ?? ''}`.trim();
  };

  const readyEmptyText = searchActive ? 'No ready travelers match your search.' : 'No covered travelers yet.';
  const pendingEmptyText = searchActive ? 'No pending travelers match your search.' : 'No pending travelers.';

  return (
    <div className="d-flex flex-column gap-3">
      {rosterError && (
        <div className="alert alert-danger mb-0">
          Roster error: {String(rosterError)}
        </div>
      )}

      <div className="card">
        <div className="card-header fw-semibold bg-agf1 text-white">Spot Overview</div>
        <div className="card-body pb-2">
          <div
            className="d-grid"
            style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(14px,1fr))', gap: 4, padding: '6px 0' }}
          >
            {overviewReady.map((m, i) => {
              const label = labelForMember(m);
              const quickLabel = label.trim();
              const key = m.member_id ?? m.id ?? i;
              const isMatch = readyMatchIds.has(String(m.member_id ?? m.id ?? ''));
              const handleActivate = () => onMemberFocus?.(quickLabel);
              const style = {
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: '#00ADBB',
                border: 'none',
                cursor: onMemberFocus ? 'pointer' : 'default',
                opacity: searchActive && !isMatch ? 0.25 : 1
              };

              if (onMemberFocus) {
                return (
                  <div
                    key={`cov-${key}-${i}`}
                    title={`Covered: ${label}`}
                    role="button"
                    tabIndex={0}
                    style={style}
                    onClick={handleActivate}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleActivate();
                      }
                    }}
                  />
                );
              }

              return (
                <div
                  key={`cov-${key}-${i}`}
                  title={`Covered: ${label}`}
                  style={style}
                />
              );
            })}
            {overviewPending.map((m, i) => {
              const label = labelForMember(m);
              const quickLabel = label.trim();
              const key = m.member_id ?? m.id ?? i;
              const isMatch = pendingMatchIds.has(String(m.member_id ?? m.id ?? ''));
              const handleActivate = () => onMemberFocus?.(quickLabel);
              const style = {
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: '#ffc107',
                border: 'none',
                cursor: onMemberFocus ? 'pointer' : 'default',
                opacity: searchActive && !isMatch ? 0.25 : 1
              };

              if (onMemberFocus) {
                return (
                  <div
                    key={`pen-${key}-${i}`}
                    title={`Pending: ${label}`}
                    role="button"
                    tabIndex={0}
                    style={style}
                    onClick={handleActivate}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleActivate();
                      }
                    }}
                  />
                );
              }

              return (
                <div
                  key={`pen-${key}-${i}`}
                  title={`Pending: ${label}`}
                  style={style}
                />
              );
            })}
            {Array.from({ length: Math.max(0, unassignedSpots) }).map((_, i) => (
              <div
                key={`free-${i}`}
                title="Unassigned seat"
                style={{ width: 14, height: 14, borderRadius: 3, background: '#fff', border: '1px solid #dee2e6' }}
              />
            ))}
          </div>

        </div>
        <div className="card-footer bg-transparent border-0 pt-0">
          <div className="row align-items-center g-2">
            <div className="col-12 col-md">
              <div className="d-flex flex-wrap align-items-center gap-2 small text-muted">
                <span className="d-inline-flex align-items-center gap-1">
                  <span className="bg-agf1" style={{ width: 12, height: 12, borderRadius: 3, display: 'inline-block' }}></span>
                  Covered
                </span>
                <span className="d-inline-flex align-items-center gap-1">
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ffc107', display: 'inline-block' }}></span>
                  Pending
                </span>
                <span className="d-inline-flex align-items-center gap-1">
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#fff', border: '1px solid #dee2e6', display: 'inline-block' }}></span>
                  Paid / Unassigned
                </span>
              </div>
            </div>
            <div className="col-12 col-md-auto text-md-end">
              {!spotAddOpen && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2 text-uppercase fw-semibold"
                  style={{ borderRadius: 6, letterSpacing: '0.05em' }}
                  onClick={() => onSpotAddToggle(true)}
                  aria-label="Add person"
                >
                  <i className="bi bi-plus-circle-fill" aria-hidden="true"></i>
                  <span>Add person</span>
                </button>
              )}
            </div>
          </div>

          {spotAddOpen && spotAddForm && (
            <div className="mt-3">
              {spotAddForm}
            </div>
          )}
      </div>
    </div>

      <div className="card">
        <div className="card-body py-2">
          <div className="input-group input-group-sm">
            <span className="input-group-text">Search</span>
            <input
              type="search"
              className="form-control"
              placeholder="Find a traveler…"
              value={searchTerm}
              onChange={handleSearchInput}
            />
            {searchTerm && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={clearSearch}
              >
                Clear
              </button>
            )}
          </div>
          {searchActive && (
            <div className="small text-muted mt-2">
              {totalMatches === 0
                ? `No travelers match "${searchLabel}"`
                : `Showing ${totalMatches} match${totalMatches === 1 ? '' : 'es'} for "${searchLabel}"`}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-start bg-agf2 text-white">
          <div className="d-flex flex-column">
            <div className="fw-semibold h5">Ready Roster</div>
            <div className="small text-white">Persons covered and ready to go</div>
          </div>
          <span className="badge bg-agf1 text-white">{coveredCount}</span>
        </div>
        <div className="card-body p-0">
          {ready.length === 0 ? (
            <div className="p-3 text-muted">{readyEmptyText}</div>
          ) : (
            ready.map(renderReady)
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-start bg-mango">
          <div className="d-flex flex-column">
            <div className="fw-semibold h5">Pending Coverage</div>
            <div className="text-muted small">Travelers are moved to ready once confirmed</div>
          </div>
          <span className="badge bg-dark">{pendingCount}</span>
        </div>
        <div className="card-body p-0">
          {pending.length === 0 ? (
            <div className="p-3 text-muted">{pendingEmptyText}</div>
          ) : (
            pending.map(renderPending)
          )}
        </div>
      </div>
    </div>
  )
}
