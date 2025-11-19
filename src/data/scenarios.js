// Dev/demo scenarios that describe expected behaviors.
// Human-editable; add or adjust rows as flows change.

export const scenarios = [
  {
    title: 'Leader pays, traveler moves from Pending to Ready',
    flow: [
      'Add traveler, mark confirmed/guardian OK.',
      'Pay spot price.',
      'System auto-allocates: covered_count +1, unassigned_spots shows remaining paid seat.'
    ],
    expected: 'Traveler appears in Ready; paid seat balance reflects remaining credit.',
    relatedTests: ['tests/api.spec.js: allocates a seat after payment']
  },
  {
    title: 'Leader moves covered traveler to Standby',
    flow: [
      'Traveler is covered (Ready).',
      'Move to Standby.',
      'Seat is released; if credits remain, Ready list shows paid spot placeholder.'
    ],
    expected: 'covered_count decreases, placeholder shows paid capacity; history logs MEMBER_REMOVED.',
    relatedTests: ['tests/api.spec.js: removing a covered traveler releases the seat']
  },
  {
    title: 'Admin marks trip paid (offline)',
    flow: [
      'Trip shows balance owed.',
      'Admin clicks Pay button in Trips list.'
    ],
    expected: 'Payment status becomes PAID; history logs PAYMENT_APPLIED.',
    relatedTests: []
  },
  {
    title: 'Claims messaging',
    flow: [
      'Leader files claim.',
      'Admin updates status or sends message.',
      'Leader sees New flag; opening claim clears it.'
    ],
    expected: 'fresh flags clear on view; messages and history record updates.',
    relatedTests: []
  },
  {
    title: 'Covered traveler moved to Standby, new traveler allocated',
    flow: [
      'Traveler is covered (Ready).',
      'Move traveler to Standby.',
      'Add/confirm another traveler and allocate to replace the standby seat.'
    ],
    expected: 'Ready count restored with new traveler; standby shows inactive prior traveler.',
    relatedTests: []
  },
  {
    title: 'Admin manages claims inline from Trips list',
    flow: [
      'Click claims count on a trip row.',
      'Select a claim from the list; update status, messages, and notes.',
      'Fresh flags clear when opened.'
    ],
    expected: 'Claim drawer shows per-claim workspace; “New” flags clear on view.',
    relatedTests: []
  },
  {
    title: 'Leader sees new claim updates',
    flow: [
      'Admin sends a claim message or changes status.',
      'Leader visits Claims page.',
      'Row shows “New”; clicking row opens detail and clears flag.'
    ],
    expected: 'New badge disappears after viewing; messages visible.',
    relatedTests: []
  },
  {
    title: 'Trip refunds unused credit',
    flow: [
      'Trip has paid seats (unassigned).',
      'Refunds initiated after trip start.',
      'Unused credit seats refunded and history logs refund.'
    ],
    expected: 'Unassigned seats become refunded; refundable amount drops.',
    relatedTests: []
  }
];
