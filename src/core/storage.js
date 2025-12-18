const NS = 'missionassure.v1';
const hasLocalStorage = typeof localStorage !== 'undefined';
const memory = new Map();

function key(name){ return `${NS}.${name}`; }

function storageGet(name){
  if (hasLocalStorage) return localStorage.getItem(key(name));
  return memory.get(name) ?? null;
}

function storageSet(name, value){
  if (hasLocalStorage) localStorage.setItem(key(name), value);
  else memory.set(name, value);
}

function storageKeys(){
  if (hasLocalStorage) {
    const keys = [];
    for (let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if (k && k.startsWith(NS + '.')) keys.push(k);
    }
    return keys;
  }
  return Array.from(memory.keys()).map(k => `${NS}.${k}`);
}

function read(name){
  const raw = storageGet(name);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function write(name, rows){
  storageSet(name, JSON.stringify(rows));
}

export const store = {
  all: read,
  byId(name, id){ return read(name).find(r => r.id === id) || null; },
  insert(name, data){
    const row = { id: crypto.randomUUID(), ...data };
    const rows = read(name); rows.push(row); write(name, rows); return row;
  },
  put(name, row){
    const rows = read(name);
    const i = rows.findIndex(r => r.id === row.id);
    if(i>=0) rows[i] = row; else rows.push(row);
    write(name, rows); return row;
  },
  where(name, pred){ return read(name).filter(pred); },
  remove(name, id){ write(name, read(name).filter(r => r.id !== id)); },
  clearAll(){
    if (hasLocalStorage) {
      for (const k of storageKeys()){
        localStorage.removeItem(k);
      }
    } else {
      memory.clear();
    }
  }
};
