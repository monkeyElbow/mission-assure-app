const KEY = 'missionassure.v1.claims';

function all(){ return JSON.parse(localStorage.getItem(KEY) || '[]'); }
function save(rows){ localStorage.setItem(KEY, JSON.stringify(rows)); }

function nextNumber(){
  const y = new Date().getFullYear();
  const n = (all().length + 1).toString().padStart(5,'0');
  return `CLM-${y}-${n}`;
}

export function listClaims(){ return all().sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt)); }

export function createClaim(data){
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    claimNumber: nextNumber(),
    status: 'SUBMITTED', // SUBMITTED|IN_REVIEW|MORE_INFO|APPROVED|DENIED|CLOSED
    notes: [],
    attachments: [],     // demo: store {id, filename, size, dataURL}
    createdAt: now, updatedAt: now,
    ...data              // tripId, tripTitle, memberName/email, reporterName/email, incident*
  };
  const rows = all(); rows.push(row); save(rows);
  return row;
}

export function updateClaim(id, patch){
  const rows = all();
  const i = rows.findIndex(c=>c.id===id);
  if(i<0) throw new Error('Claim not found');
  rows[i] = { ...rows[i], ...patch, updatedAt: new Date().toISOString() };
  save(rows); return rows[i];
}

export function addClaimNote(id, author, text){
  const rows = all();
  const i = rows.findIndex(c=>c.id===id);
  if(i<0) throw new Error('Claim not found');
  const note = { id: crypto.randomUUID(), author, text, createdAt: new Date().toISOString() };
  rows[i].notes = [note, ...(rows[i].notes||[])];
  save(rows); return rows[i];
}

export function addClaimAttachment(id, file){
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
        save(rows); resolve(rows[i]);
      }catch(e){ reject(e); }
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
