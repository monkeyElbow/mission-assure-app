const KEY = 'missionassure.v1.claims';
let historyLogger = null; // optional hook injected by api layer to record history events

export function setClaimHistoryLogger(fn){
  historyLogger = typeof fn === 'function' ? fn : null;
}

function all(){ return JSON.parse(localStorage.getItem(KEY) || '[]'); }
function save(rows){ localStorage.setItem(KEY, JSON.stringify(rows)); }

function nextNumber(prefix = 'CLM'){
  const y = new Date().getFullYear();
  const n = (all().length + 1).toString().padStart(5,'0');
  return `${prefix}-${y}-${n}`;
}

function ensureFlags(row = {}){
  row.freshForAdmin = !!row.freshForAdmin;
  row.freshForLeader = !!row.freshForLeader;
  row.messages = Array.isArray(row.messages) ? row.messages : [];
  row.notes = Array.isArray(row.notes) ? row.notes : [];
  row.attachments = Array.isArray(row.attachments) ? row.attachments : [];
  return row;
}

export function listClaims(){ return all().sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt)); }

export function createClaim(data){
  const now = new Date().toISOString();
  const tripShort = data.tripShortId || data.tripShort || data.shortId || (data.tripId ? String(data.tripId).slice(-6) : '');
  const prefix = tripShort ? `CLM-${tripShort}` : 'CLM';
  const firstName = data.memberFirstName || '';
  const lastName = data.memberLastName || '';
  const combinedName = data.memberName || `${firstName} ${lastName}`.trim() || data.memberEmail || 'Traveler';
  const row = {
    id: crypto.randomUUID(),
    claimNumber: nextNumber(prefix),
    status: 'SUBMITTED', // SUBMITTED|IN_REVIEW|MORE_INFO|APPROVED|DENIED|CLOSED
    notes: [],
    attachments: [],     // demo: store {id, filename, size, dataURL}
    messages: [],
    freshForAdmin: true,
    freshForLeader: false,
    createdAt: now, updatedAt: now,
    ...data,             // tripId, tripTitle, provided fields
    incidentDescription: data.incidentDescription || data.description || '',
    memberFirstName: firstName,
    memberLastName: lastName,
    memberName: combinedName,
    memberPhone: data.memberPhone || '',
  };
  ensureFlags(row);
  const rows = all(); rows.push(row); save(rows);
  historyLogger?.({
    type: 'CLAIM_CREATED',
    tripId: row.tripId,
    claimNumber: row.claimNumber,
    notes: `Claim submitted by ${row.reporterName || 'leader'}`,
    status: row.status
  });
  return row;
}

export function updateClaim(id, patch, { actorRole='ADMIN' } = {}){
  const rows = all();
  const i = rows.findIndex(c=>c.id===id);
  if(i<0) throw new Error('Claim not found');
  const before = ensureFlags(rows[i]);
  const after = ensureFlags({ ...before, ...patch, updatedAt: new Date().toISOString() });
  if (actorRole === 'ADMIN') { after.freshForLeader = true; after.freshForAdmin = false; }
  if (actorRole === 'LEADER') { after.freshForAdmin = true; after.freshForLeader = false; }
  rows[i] = after;
  save(rows);
  if (patch.status && patch.status !== before.status) {
    historyLogger?.({
      type: 'CLAIM_STATUS_UPDATED',
      tripId: after.tripId,
      claimNumber: after.claimNumber,
      notes: `Status: ${before.status || 'N/A'} -> ${patch.status}`
    });
  }
  return rows[i];
}

export function addClaimNote(id, author, text, { actorRole='ADMIN' } = {}){
  const rows = all();
  const i = rows.findIndex(c=>c.id===id);
  if(i<0) throw new Error('Claim not found');
  const note = { id: crypto.randomUUID(), author, text, createdAt: new Date().toISOString() };
  rows[i].notes = [note, ...(rows[i].notes||[])];
  ensureFlags(rows[i]);
  if (actorRole === 'ADMIN') {
    // notes are admin-only, so don't flag the leader; just clear admin freshness
    rows[i].freshForAdmin = false;
  }
  if (actorRole === 'LEADER') { rows[i].freshForAdmin = true; rows[i].freshForLeader = false; }
  save(rows);
  const after = rows[i];
  historyLogger?.({
    type: 'CLAIM_NOTE_ADDED',
    tripId: after.tripId,
    claimNumber: after.claimNumber,
    notes: `${author || 'User'} left a note: ${String(text || '').slice(0,120)}`
  });
  return rows[i];
}

export function addClaimAttachment(id, file, { actorRole='ADMIN' } = {}){
  // file is a File object; we read to dataURL for demo
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>{
      try{
        const rows = all();
        const i = rows.findIndex(c=>c.id===id);
        if(i<0) throw new Error('Claim not found');
        const meta = { id: crypto.randomUUID(), filename:file.name, size:file.size, mime:file.type, dataURL: fr.result };
        rows[i].attachments = [...(rows[i].attachments||[]), meta];
        ensureFlags(rows[i]);
        if (actorRole === 'ADMIN') rows[i].freshForLeader = true;
        if (actorRole === 'LEADER') rows[i].freshForAdmin = true;
        save(rows);
        const after = rows[i];
        historyLogger?.({
          type: 'CLAIM_ATTACHMENT_ADDED',
          tripId: after.tripId,
          claimNumber: after.claimNumber,
          notes: `Attachment added: ${file.name}`
        });
        resolve(rows[i]);
      }catch(e){ reject(e); }
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export function addClaimMessage(id, { authorRole='ADMIN', authorName='', text }){
  const rows = all();
  const i = rows.findIndex(c=>c.id===id);
  if(i<0) throw new Error('Claim not found');
  const row = ensureFlags(rows[i]);
  const msg = {
    id: crypto.randomUUID(),
    authorRole,
    authorName,
    text,
    createdAt: new Date().toISOString()
  };
  row.messages = [msg, ...(row.messages||[])];
  if (authorRole === 'ADMIN') { row.freshForLeader = true; row.freshForAdmin = false; }
  if (authorRole === 'LEADER') { row.freshForAdmin = true; row.freshForLeader = false; }
  rows[i] = row;
  save(rows);
  historyLogger?.({
    type: 'CLAIM_MESSAGE_ADDED',
    tripId: row.tripId,
    claimNumber: row.claimNumber,
    notes: `${authorRole} sent a message: ${String(text||'').slice(0,120)}`
  });
  return row;
}

export function markClaimSeen(id, role='ADMIN'){
  const rows = all();
  const i = rows.findIndex(c=>c.id===id);
  if(i<0) return null;
  const row = ensureFlags(rows[i]);
  if (role === 'ADMIN') row.freshForAdmin = false;
  if (role === 'LEADER') row.freshForLeader = false;
  row.updatedAt = new Date().toISOString();
  rows[i] = row;
  save(rows);
  return row;
}

export function removeClaimsForTrip(tripId){
  if (!tripId) return;
  const kept = all().filter(c => c.tripId !== tripId);
  save(kept);
}
