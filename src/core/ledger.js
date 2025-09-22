import { store } from '../core/storage'

const T_PAYMENTS = 'payments'

export function listPayments(tripId){
  return store.where(T_PAYMENTS, p => p.tripId === tripId).sort((a,b)=>+new Date(a.createdAt)-+new Date(b.createdAt))
}

export function sumCredits(tripId){
  const ps = listPayments(tripId)
  return ps.reduce((sum,p)=> sum + (p.type==='CHARGE'? p.amountCents : -p.amountCents), 0)
}

export function addPayment({ tripId, amountCents, type='CHARGE', provider='DEV', providerRef }){
  const now = new Date().toISOString()
  return store.insert(T_PAYMENTS, { tripId, amountCents, type, provider, providerRef, createdAt: now })
}