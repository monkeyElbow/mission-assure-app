const NS = 'missionassure.v1';

function key(name){ return `${NS}.${name}`; }
function read(name){ try { return JSON.parse(localStorage.getItem(key(name))||'[]'); } catch { return []; } }
function write(name, rows){ localStorage.setItem(key(name), JSON.stringify(rows)); }

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
};
