export function filterItems(items = [], filters = {}) {
    const { q = "", status = "active", upcomingDays = "", from = "", to = "" } = filters;
  
    const qNorm = q.trim().toLowerCase();
    const now = new Date();
  
    const parseDate = (s) => (s ? new Date(s) : null);
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    const upcomingLimit = upcomingDays ? new Date(now.getTime() + Number(upcomingDays) * 86400000) : null;
  
    return items.filter((it) => {
      if (status !== "all" && it.status !== status) return false;
  
      if (qNorm) {
        const hay = [
          it.title, it.name, it.id, it.notes, it.description, it.owner
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(qNorm)) return false;
      }
  
      if (fromDate || toDate) {
        const d = it.dueAt ? new Date(it.dueAt) : null;
        if (!d) return false;
        if (fromDate && d < new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())) return false;
        if (toDate && d > new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999)) return false;
      }
  
      if (upcomingLimit) {
        const d = it.dueAt ? new Date(it.dueAt) : null;
        if (!d) return false;
        if (!(d >= now && d <= upcomingLimit)) return false;
      }
  
      return true;
    });
  }
  