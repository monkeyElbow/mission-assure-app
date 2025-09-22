import { store } from '../core/storage';
import { seedRatesIfEmpty, selectRate } from '../core/rates';

const T_TRIPS = 'trips';
const T_MEMBERS = 'members';

function nextTripShortId(){
    const y = new Date().getFullYear();
    const seq = (store.all('trips').length + 1).toString().padStart(6, '0');
    return `MA-${y}-${seq}`;
  }
  

// quick demo seeding
export function seedDemoIfEmpty(){
  seedRatesIfEmpty();
  if (store.all(T_TRIPS).length === 0) {
    const trip = store.insert(T_TRIPS, {
      title: 'Summer Missions',
      leaderId: 'demo-leader',
      startDate: '2025-07-10',
      endDate: '2025-07-18',
      region: 'DOMESTIC',
      rateCents: 125, // snapshot
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    ['Ana','Ben','Chris','Dana'].forEach(n=>{
      store.insert(T_MEMBERS, {
        tripId: trip.id,
        firstName: n,
        lastName: 'Ray',
        email: `${n.toLowerCase()}@demo.io`,
        status: 'IN_PROGRESS'
      });
    });
  }
}

export const api = {

    async deleteTrip(id){
        // delete trip
        store.remove(T_TRIPS, id);
      
        // delete members for this trip
        const toDelete = store.where(T_MEMBERS, m => m.tripId === id);
        for (const m of toDelete) store.remove(T_MEMBERS, m.id);
      
        // optional: delete claims tied to this trip (if claims module present)
        try {
          const { removeClaimsForTrip } = await import('../core/claims');
          removeClaimsForTrip(id);
        } catch {} // ignore if claims module not loaded
      
        return true;
      },
      
  async listTrips(){
    return store
      .all(T_TRIPS)
      .sort((a,b)=>+new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async getTrip(id){
    const trip = store.byId(T_TRIPS, id);
    const members = store.where(T_MEMBERS, m => m.tripId === id);
    return { trip, members };
  },

  async createTrip(input){ // {title,startDate,endDate,region}
    seedRatesIfEmpty();
    const rate = selectRate(input.region, input.startDate);
    if (!rate) throw new Error('No applicable rate for that start date.');
    const now = new Date().toISOString();
    return store.insert(T_TRIPS, {
        shortId: nextTripShortId(),        // NEW
        ...input,
        rateCents: rate.amountCents,
        paymentStatus: 'UNPAID',           // NEW: UNPAID | PAID
        status: 'ACTIVE',
        createdAt: now, updatedAt: now
      });
      
  },

  async updateTrip(id, patch){
    const trips = store.all(T_TRIPS);
    const i = trips.findIndex(t => t.id === id);
    if (i < 0) throw new Error('Trip not found');
    const next = { ...trips[i], ...patch, updatedAt: new Date().toISOString() };
    store.put(T_TRIPS, next);
    return next;
  },

  async addMembers(tripId, arr){ // [{firstName,lastName,email}]
    return arr.map(data =>
      store.insert(T_MEMBERS, { tripId, status: 'IN_PROGRESS', ...data })
    );
  },

  async updateMember(memberId, patch){
    const m = store.byId(T_MEMBERS, memberId);
    if (!m) throw new Error('Member not found');
    const next = { ...m, ...patch };
    store.put(T_MEMBERS, next);
    return next;
  },

  async removeMember(memberId){
    store.remove(T_MEMBERS, memberId);
    return true;
  }
};
