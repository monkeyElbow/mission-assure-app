import React, { useState } from 'react'
import InlineNotice from '../InlineNotice.jsx'
import TourCallout from '../tour/TourCallout.jsx'

export default function TripMembersList({
  ready = [],
  pending = [],
  standby = [],
  overviewReady = ready,
  overviewPending = pending,
  coveredCount = 0,
  pendingCount = 0,
  standbyCount = 0,
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
  renderPendingItem,
  renderStandbyItem,
  tourActiveStep = null,
  tourStepLabel = '',
  tourStepIndex = 0,
  tourStepTotal = 0,
  onTourDismiss = () => {},
  onTourTurnOff = () => {},
  rosterNotice = ''
}) {
  const renderReady = renderReadyItem || (() => null);
  const renderPending = renderPendingItem || (() => null);
  const renderStandby = renderStandbyItem || renderPending;
  const totalMatches = ready.length + pending.length + standby.length;
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
  const stepLabel = tourStepLabel || (tourStepIndex ? `Step ${tourStepIndex} of ${tourStepTotal || tourStepIndex}` : '');
  const sectionClass = (key) => (tourActiveStep ? (tourActiveStep === key ? 'tour-focus' : 'tour-dim') : '');
  const [spotTip, setSpotTip] = useState(false);
  const [readyTip, setReadyTip] = useState(false);
  const [pendingTip, setPendingTip] = useState(false);

  return (
    <div className="d-flex flex-column gap-3">
      {rosterNotice && (
        <InlineNotice tone="info" timeoutMs={4000} className="mb-0">
          {rosterNotice}
        </InlineNotice>
      )}
      {rosterError && (
        <InlineNotice tone="danger" dismissible timeoutMs={null} className="mb-0">
          Roster error: {String(rosterError)}
        </InlineNotice>
      )}

      <div className={`card position-relative ${sectionClass('spotOverview')}`}>
        <div className="card-header fw-semibold bg-agf1 text-white d-flex justify-content-between align-items-center">
          <span>Spot Overview</span>
          <button
            type="button"
            className="btn btn-sm btn-link text-white text-decoration-none p-0"
            onClick={() => setSpotTip(v => !v)}
            aria-label="Toggle spot overview tip"
          >
            <i className="bi bi-question-circle" aria-hidden="true"></i>
          </button>
        </div>
        <div className="card-body pb-2">
          {spotTip ? (
            <TourCallout
              title="Spot overview"
              description="Blue squares are covered travelers, yellow are pending, and empty squares are paid seats waiting to assign."
              stepLabel={stepLabel}
              onDismiss={() => setSpotTip(false)}
              dismissLabel="Close"
              showTurnOff={false}
            />
          ) : (
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
          )}

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
          {tourActiveStep === 'spotOverview' && (
            <TourCallout
              className="tour-flyout"
              title="Start with the spot overview"
              description="Each square represents a traveler—blue is covered, yellow is pending, and empty squares are paid seats you can assign next."
              stepLabel={stepLabel}
              onDismiss={() => onTourDismiss('spotOverview')}
              onTurnOff={onTourTurnOff}
            />
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

      <div className={`card position-relative ${sectionClass('readyRoster')}`}>
        <div className="card-header d-flex justify-content-between align-items-start bg-agf2 text-white">
          <div className="d-flex flex-column">
            <div className="fw-semibold">Ready Roster <span className="badge bg-agf1 text-white">{coveredCount}</span></div>
            <div className="small text-white">Persons covered and ready to go</div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-link text-white text-decoration-none p-0"
            onClick={() => setReadyTip(v => !v)}
            aria-label="Toggle ready roster tip"
          >
            <i className="bi bi-question-circle" aria-hidden="true"></i>
          </button>
        </div>
        <div className="card-body p-0">
          {readyTip ? (
            <div className="p-3">
              <TourCallout
                title="Ready roster"
                description="Covered travelers appear here. Edit, release seats, or open a traveler to adjust their guardian or confirmation status."
                stepLabel={stepLabel}
                onDismiss={() => setReadyTip(false)}
                dismissLabel="Close"
                showTurnOff={false}
              />
            </div>
          ) : ready.length === 0 ? (
            <div className="p-3 text-muted">{readyEmptyText}</div>
          ) : (
            ready.map(renderReady)
          )}
        </div>
        {tourActiveStep === 'readyRoster' && (
          <TourCallout
            className="tour-flyout"
            title="Ready roster"
            description="Covered travelers appear here. Edit, release seats, or open a traveler to adjust their guardian or confirmation status."
            stepLabel={stepLabel}
            onDismiss={() => onTourDismiss('readyRoster')}
            onTurnOff={onTourTurnOff}
          />
        )}
      </div>

      <div className={`card position-relative ${sectionClass('pendingCoverage')}`}>
        <div className="card-header d-flex justify-content-between align-items-start bg-mango">
          <div className="d-flex flex-column">
            <div className="fw-semibold">Pending Coverage <span className="badge bg-dark">{pendingCount}</span></div>
            <div className="text-muted small">Travelers are moved to ready once confirmed</div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-link text-dark text-decoration-none p-0"
            onClick={() => setPendingTip(v => !v)}
            aria-label="Toggle pending coverage tip"
          >
            <i className="bi bi-question-circle" aria-hidden="true"></i>
          </button>
        </div>
        <div className="card-body p-0">
          {pendingTip ? (
            <div className="p-3">
              <TourCallout
                title="Pending coverage"
                description="These travelers still need confirmation or guardian approval. Once they’re eligible, assign an open seat to move them to Ready."
                stepLabel={stepLabel}
                onDismiss={() => setPendingTip(false)}
                dismissLabel="Close"
                showTurnOff={false}
              />
            </div>
          ) : pending.length === 0 ? (
            <div className="p-3 text-muted">{pendingEmptyText}</div>
          ) : (
            pending.map(renderPending)
          )}
        </div>
        {tourActiveStep === 'pendingCoverage' && (
          <TourCallout
            className="tour-flyout"
            title="Pending coverage"
            description="These travelers still need confirmation or guardian approval. Once they’re eligible, assign an open seat to move them to Ready."
            stepLabel={stepLabel}
            onDismiss={() => onTourDismiss('pendingCoverage')}
            onTurnOff={onTourTurnOff}
          />
        )}
      </div>

      <div className="card position-relative">
        <div className="card-header d-flex justify-content-between align-items-start bg-light">
          <div className="d-flex flex-column">
            <div className="fw-semibold mb-0">Standby <span className="badge text-bg-secondary">{standbyCount}</span></div>
            <div className="text-muted small">Inactive travelers; seats released to the pool</div>
          </div>
        </div>
        <div className="card-body p-0">
          {standby.length === 0 ? (
            <div className="p-3 text-muted">No standby travelers.</div>
          ) : (
            standby.map(renderStandby)
          )}
        </div>
      </div>
    </div>
  )
}
