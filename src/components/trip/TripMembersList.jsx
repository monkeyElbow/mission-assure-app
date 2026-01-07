import React, { useMemo, useState } from 'react'
import InlineNotice from '../InlineNotice.jsx'
import TourCallout from '../tour/TourCallout.jsx'

export default function TripMembersList({
  ready = [],
  awaitingPayment = [],
  awaitingConfirmation = [],
  standby = [],
  coveredCount = 0,
  unassignedSpots = 0,
  spotAddOpen = false,
  onSpotAddToggle = () => {},
  spotAddForm = null,
  bottomAddOpen = false,
  onBottomAddToggle = () => {},
  bottomAddForm = null,
  rosterError = null,
  searchTerm = '',
  onSearchTermChange = () => {},
  searchActive = false,
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

  const totalMatches = ready.length + awaitingPayment.length + awaitingConfirmation.length + standby.length;
  const searchLabel = searchTerm.trim();

  const handleSearchInput = (event) => onSearchTermChange?.(event.target.value);
  const clearSearch = () => onSearchTermChange?.('');

  const readyEmptyText = searchActive ? 'No ready travelers match your search.' : 'No covered travelers yet.';
  const awaitingPaymentEmpty = searchActive ? 'No travelers awaiting payment match your search.' : 'No travelers awaiting payment.';
  const awaitingConfirmEmpty = searchActive ? 'No travelers awaiting confirmation match your search.' : 'No travelers awaiting confirmation.';

  const searchResults = useMemo(
    () => [
      ...ready.map((member) => ({ member, status: 'ready' })),
      ...awaitingPayment.map((member) => ({ member, status: 'payment' })),
      ...awaitingConfirmation.map((member) => ({ member, status: 'confirm' })),
      ...standby.map((member) => ({ member, status: 'standby' }))
    ],
    [ready, awaitingPayment, awaitingConfirmation, standby]
  );

  const [rosterTip, setRosterTip] = useState(false);
  const [readyTip, setReadyTip] = useState(false);
  const [paymentTip, setPaymentTip] = useState(false);
  const [confirmTip, setConfirmTip] = useState(false);
  const [standbyTip, setStandbyTip] = useState(false);
  const tourClass = (step) => (tourActiveStep ? (tourActiveStep === step ? 'tour-focus' : 'tour-dim') : '');
  const tourDim = tourActiveStep ? 'tour-dim' : '';
  const cardBaseStyle = {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '10px 12px'
  };
  const cardBorderByStatus = {
    ready: 'var(--agf2)',
    payment: 'var(--melon)',
    confirm: 'var(--mango)',
    standby: '#cbd5e1'
  };
  const wrapCard = (status, child, key) => (
    <div
      key={key}
      className={`trip-member-card trip-member-card--${status}`}
      style={{ ...cardBaseStyle, borderColor: cardBorderByStatus[status] || cardBaseStyle.borderColor }}
    >
      {child}
    </div>
  );

  return (
    <div className="d-flex flex-column gap-3">
      {rosterNotice && (
        <InlineNotice tone="info" timeoutMs={null} className="mb-0">
          {rosterNotice}
        </InlineNotice>
      )}
      {rosterError && (
        <InlineNotice tone="danger" dismissible timeoutMs={null} className="mb-0">
          Roster error: {String(rosterError)}
        </InlineNotice>
      )}

      <div className="card">
        <div className="card-header bg-agf1 text-white fw-bold d-flex justify-content-between align-items-center">
          <span>Roster</span>
          <button
            type="button"
            className="btn btn-sm btn-link text-white text-decoration-none p-0"
            onClick={() => setRosterTip(v => !v)}
            aria-label="Toggle roster overview tip"
          >
            <i className="bi bi-question-circle" aria-hidden="true"></i>
          </button>
        </div>
        <div className="card-body d-flex flex-column gap-3">
          {rosterTip && (
            <TourCallout
              title="Roster"
              description="Track everyone added to the trip. Confirm travelers and apply credit so they move into Ready and Covered."
              stepLabel={tourStepLabel || (tourStepIndex ? `Step ${tourStepIndex} of ${tourStepTotal || tourStepIndex}` : '')}
              onDismiss={() => setRosterTip(false)}
              dismissLabel="Close"
              showTurnOff={false}
            />
          )}

          {!spotAddOpen && (
            <div>
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
            </div>
          )}

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

          {spotAddOpen && spotAddForm && (
            <div className="mt-1">
              {spotAddForm}
            </div>
          )}

          {searchActive && (
            <div className="small text-muted">
              {totalMatches === 0
                ? `No travelers match "${searchLabel}"`
                : `Showing ${totalMatches} match${totalMatches === 1 ? '' : 'es'} for "${searchLabel}"`}
            </div>
          )}

          {searchActive ? (
            <div className="d-flex flex-column gap-2">
              {searchResults.length === 0 ? (
                <div className="text-muted">No travelers match “{searchLabel}”.</div>
              ) : (
                searchResults.map(({ member, status }, idx) => {
                  const key = member.member_id ?? member.id ?? idx;
                  if (status === 'ready') return wrapCard('ready', renderReady(member), key);
                  if (status === 'standby') return wrapCard('standby', renderStandby(member), key);
                  if (status === 'confirm') return wrapCard('confirm', renderPending(member), key);
                  return wrapCard('payment', renderPending(member), key);
                })
              )}
            </div>
          ) : (
            <>
              <div className={`border rounded-3 p-3 ${tourClass('readyRoster')}`} data-tour-step="readyRoster">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">Ready and Covered <span className="badge bg-agf1 text-white">{coveredCount}</span></div>
                    <div className="small text-muted">Paid + confirmed travelers</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-decoration-none p-0 text-muted"
                    onClick={() => setReadyTip(v => !v)}
                    aria-label="Toggle ready roster tip"
                  >
                    <i className="bi bi-question-circle" aria-hidden="true"></i>
                  </button>
                </div>
                <div className="mt-2 pt-2">
                  {readyTip ? (
                    <TourCallout
                      title="Ready roster"
                      description="Covered travelers appear here. Edit, release credit, or open a traveler to adjust their guardian or confirmation status."
                      stepLabel={tourStepLabel || (tourStepIndex ? `Step ${tourStepIndex} of ${tourStepTotal || tourStepIndex}` : '')}
                      onDismiss={() => setReadyTip(false)}
                      dismissLabel="Close"
                      showTurnOff={false}
                    />
                  ) : ready.length === 0 ? (
                    <div className="text-muted">{readyEmptyText}</div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {ready.map((member, idx) => {
                        const key = member.member_id ?? member.id ?? idx;
                        return wrapCard('ready', renderReady(member), key);
                      })}
                    </div>
                  )}
                  {unassignedSpots > 0 && (
                    <div className="border rounded-3 p-3 bg-white mt-2">
                      <div className="fw-semibold small">Paid spot available</div>
                      <div className="text-muted small">
                        {unassignedSpots === 1
                          ? 'You have 1 paid spot ready—move an eligible traveler here, by adding and confirming travelers.'
                          : `You have ${unassignedSpots} paid spots ready—move eligible travelers here, by adding and confirming travelers.`}
                      </div>
                    </div>
                  )}
                </div>
                {tourActiveStep === 'readyRoster' && (
                  <TourCallout
                    className="tour-flyout"
                    title="Ready roster"
                    description="Covered travelers appear here. Edit, release credit, or open a traveler to adjust their guardian or confirmation status."
                    stepLabel={tourStepLabel}
                    onDismiss={() => onTourDismiss('readyRoster')}
                    onTurnOff={onTourTurnOff}
                  />
                )}
              </div>

              <div className={`p-3 bg-light rounded-3 border ${tourDim}`}>
                <div className="fw-semibold fs-6 text-danger mb-0">Below this point, these travelers are NOT covered.</div>
                <div className="small text-muted">Apply credit to move them to Ready and Covered.</div>
              </div>

              <div className={`position-relative border rounded-3 p-3 ${tourClass('pendingCoverage')}`} data-tour-step="pendingCoverage">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold agf2">Awaiting Payment <span className="badge bg-secondary">{awaitingPayment.length}</span></div>
                    <div className="small text-muted">Confirmed/approved but awaiting credit payment</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-decoration-none p-0"
                    onClick={() => setPaymentTip(v => !v)}
                    aria-label="Toggle awaiting payment tip"
                  >
                    <i className="bi bi-question-circle" aria-hidden="true"></i>
                  </button>
                </div>
                <div className="mt-2 pt-2">
                  {paymentTip ? (
                    <TourCallout
                      title="Awaiting payment"
                      description="These travelers are eligible but need credit applied. Pay the balance or apply available credit to move them to Ready."
                      stepLabel={tourStepLabel}
                      onDismiss={() => setPaymentTip(false)}
                      dismissLabel="Close"
                      showTurnOff={false}
                    />
                  ) : awaitingPayment.length === 0 ? (
                    <div className="text-muted">{awaitingPaymentEmpty}</div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {awaitingPayment.map((member, idx) => {
                        const key = member.member_id ?? member.id ?? idx;
                        return wrapCard('payment', renderPending(member), key);
                      })}
                    </div>
                  )}
                </div>
                {tourActiveStep === 'pendingCoverage' && (
                  <TourCallout
                    className="tour-flyout"
                    title="Awaiting payment"
                    description="These travelers are eligible but need credit applied. Pay the balance or apply available credit to move them to Ready."
                    stepLabel={tourStepLabel}
                    onDismiss={() => onTourDismiss('pendingCoverage')}
                    onTurnOff={onTourTurnOff}
                  />
                )}
              </div>

              <div className={`position-relative border rounded-3 p-3 ${tourClass('awaitingConfirmation')}`} data-tour-step="awaitingConfirmation">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold text-mango">Awaiting Confirmation <span className="badge bg-dark">{awaitingConfirmation.length}</span></div>
                    <div className="small text-muted">Needs confirmation or guardian approval</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-decoration-none p-0"
                    onClick={() => setConfirmTip(v => !v)}
                    aria-label="Toggle awaiting confirmation tip"
                  >
                    <i className="bi bi-question-circle" aria-hidden="true"></i>
                  </button>
                </div>
              <div className="mt-2 pt-2">
                {confirmTip ? (
                  <TourCallout
                    title="Awaiting confirmation"
                    description="These travelers still need confirmation or guardian approval. Mark them eligible and then apply credit to move them to Ready."
                    stepLabel={tourStepLabel}
                    onDismiss={() => setConfirmTip(false)}
                    dismissLabel="Close"
                    showTurnOff={false}
                  />
                ) : awaitingConfirmation.length === 0 ? (
                  <div className="text-muted">{awaitingConfirmEmpty}</div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {awaitingConfirmation.map((member, idx) => {
                      const key = member.member_id ?? member.id ?? idx;
                      return wrapCard('confirm', renderPending(member), key);
                    })}
                  </div>
                )}
              </div>
              {tourActiveStep === 'awaitingConfirmation' && (
                <TourCallout
                  className="tour-flyout"
                  title="Awaiting confirmation"
                  description="These travelers need confirmation or guardian approval before they can be covered."
                  stepLabel={tourStepLabel}
                  onDismiss={() => onTourDismiss('awaitingConfirmation')}
                  onTurnOff={onTourTurnOff}
                />
              )}
            </div>

              <div className={`position-relative border rounded-3 p-3 ${tourClass('standbyRoster')}`} data-tour-step="standbyRoster">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold mb-0">Standby <span className="badge text-bg-secondary">{standby.length}</span></div>
                    <div className="text-muted small">Inactive travelers; credit freed up</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-decoration-none p-0"
                    onClick={() => setStandbyTip(v => !v)}
                    aria-label="Toggle standby tip"
                  >
                    <i className="bi bi-question-circle" aria-hidden="true"></i>
                  </button>
                </div>
                <div className="mt-2 pt-2">
                  {standby.length === 0 ? (
                    <div className="text-muted">No standby travelers.</div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {standby.map((member, idx) => {
                        const key = member.member_id ?? member.id ?? idx;
                        return wrapCard('standby', renderStandby(member), key);
                      })}
                    </div>
                  )}
                </div>
                {standbyTip && (
                  <TourCallout
                    className="tour-flyout"
                    title="Standby"
                    description="Travelers on standby are inactive; their credit is available for others. Reactivate and apply credit to move back to Ready."
                    stepLabel={tourStepLabel}
                    onDismiss={() => setStandbyTip(false)}
                    dismissLabel="Close"
                    showTurnOff={false}
                  />
                )}
                {tourActiveStep === 'standbyRoster' && (
                  <TourCallout
                    className="tour-flyout"
                    title="Standby"
                    description="Standby travelers are inactive and free their paid seat for someone else."
                    stepLabel={tourStepLabel}
                    onDismiss={() => onTourDismiss('standbyRoster')}
                    onTurnOff={onTourTurnOff}
                  />
                )}
              </div>
            </>
          )}

          {bottomAddForm && (
            <div className={`mt-3 pt-3 border-top ${tourClass('addPerson')}`} data-tour-step="addPerson">
              {!bottomAddOpen ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2 text-uppercase fw-semibold"
                  style={{ borderRadius: 6, letterSpacing: '0.05em' }}
                  onClick={() => onBottomAddToggle(true)}
                  aria-label="Add person"
                >
                  <i className="bi bi-plus-circle-fill" aria-hidden="true"></i>
                  <span>Add person</span>
                </button>
              ) : (
                bottomAddForm
              )}
              {tourActiveStep === 'addPerson' && (
                <TourCallout
                  className="tour-flyout"
                  title="Add a traveler"
                  description="Finish the tour by adding a traveler so we can confirm and cover them."
                  stepLabel={tourStepLabel}
                  onDismiss={() => onTourDismiss('addPerson')}
                  onTurnOff={onTourTurnOff}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
