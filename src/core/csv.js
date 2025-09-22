export function toCSV(rows){
    if(!rows || rows.length===0) return '';
    const keys = Object.keys(rows[0]);
    const esc = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
    return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
  }
  
  export function download(filename, text){
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  