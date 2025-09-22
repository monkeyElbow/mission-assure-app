export function daysInclusive(aISO, bISO){
    const a = new Date(aISO), b = new Date(bISO);
    a.setHours(0,0,0,0); b.setHours(0,0,0,0);
    return Math.floor((b - a)/86400000) + 1;
  }
  export function computeTripTotalCents(trip, members){
    const perDay = trip.rateCents; // snapshot
    const days = daysInclusive(trip.startDate, trip.endDate);
    const count = members.length || 0;
    return perDay * days * count;
  }
  