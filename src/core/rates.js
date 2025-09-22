import { store } from './storage';

const T = 'rates';

export function seedRatesIfEmpty(){
  if(store.all(T).length === 0){
    store.insert(T, { region:'DOMESTIC', amountCents:125, effectiveStart:'2025-01-01' });
    store.insert(T, { region:'INTERNATIONAL',  amountCents:425, effectiveStart:'2025-01-01' });
  }
}

export function listRates(){
  return store.all(T).sort((a,b)=>+new Date(b.effectiveStart) - +new Date(a.effectiveStart));
}

export function createRate({ region, amountCents, effectiveStart, notes }){
  if(!region || !amountCents || !effectiveStart) throw new Error('Missing fields');
  // prevent duplicate on same region + effectiveStart
  const exists = store.all(T).some(r => r.region===region && r.effectiveStart===effectiveStart);
  if(exists) throw new Error('Rate already exists for this region and date.');
  return store.insert(T, { region, amountCents, effectiveStart, notes });
}

export function selectRate(region, tripStartISO){
  const start = new Date(tripStartISO);
  const rows = listRates()
    .filter(r => r.region === region && new Date(r.effectiveStart) <= start);
  return rows[0] || null;
}
