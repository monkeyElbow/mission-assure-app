// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, seedDemoIfEmpty } from '../data/api';
import { daysInclusive } from '../core/pricing';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeSlide } from '../ui/motion';
import DashSearch from '../components/DashSearch';
import { Container, Card, Row, Col } from 'react-bootstrap';
import AppLogoIntro from '../ui/AppLogoIntro';

// ---- helpers ----
const cents = (n = 0) =>
  (n / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

function buildMeta(trip) {
  const members = Array.isArray(trip?.members) ? trip.members : [];
  const isConfirmed = (m) => (m.isMinor ? m.guardianApproved : m.confirmed);

  const memberCount = members.length;
  const confirmedCount = members.filter(isConfirmed).length;
  const unconfirmedCount = Math.max(0, memberCount - confirmedCount);

  const days = daysInclusive(trip.startDate, trip.endDate) || 0;
  const rateCents = trip?.rateCents || 0;
  const creditsCents = trip?.creditsTotalCents || 0;

  // Charge confirmed people only
  const subtotalCents = rateCents * days * confirmedCount;
  const balanceDueCents = Math.max(0, subtotalCents - creditsCents);

  const status =
    confirmedCount === 0 ? 'SETUP' :
    balanceDueCents > 0  ? 'DUE'   :
                           'READY';

  const canPayNow = confirmedCount > 0 && balanceDueCents > 0;

  return {
    memberCount,
    confirmedCount,
    unconfirmedCount,
    subtotalCents,
    creditsCents,
    balanceDueCents,
    status,
    canPayNow,
  };
}

// ---- card ----
function TripCard({ t, meta = {} }) {
  const {
    memberCount = 0,
    confirmedCount = 0,
    unconfirmedCount = 0,
    balanceDueCents = 0,
    status = 'SETUP',
  } = meta;

  const days = daysInclusive(t.startDate, t.endDate) || 0;
  const perDay = (t.rateCents / 100).toFixed(2);

  return (
        <motion.div className="h-100" layout>

          
    <Card className="p-4 h-100">
          <h2 className="h4 mb-1">
            {t.title} 
          </h2>
      <Row>
        <Col md={8}>
          <p className='fw-bold small fs-5 lh-sm'>
            {t.shortId && <span className="text-muted small">#{t.shortId}</span>}
          </p>
          <div className="badge bg-dark mb-2">{t.region}</div>
        
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <div className="small text-muted">
            {t.startDate} → {t.endDate} • {days} days • {confirmedCount}/{memberCount} confirmed • ${perDay}/day
          </div>
        </div>

      </div>
        </Col>
        <Col  className='d-flex flex-column justify-content-right gap-1 p-2'>
        
            {status === 'DUE' && (
              <motion.span
              key="due"
              className="badge bg-warning text-dark"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              >
                Pay {cents(balanceDueCents)}
              </motion.span>
            )}
            {status === 'READY' && (
              <motion.span
              key="ready"
              className="badge bg-agf1"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              >
                Ready
              </motion.span>
            )}
          <AnimatePresence>
            {status === 'SETUP' && (
              <motion.span
              key="setup"
              className="badge text-bg-secondary"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              >
                Confirm people
              </motion.span>
            )}
            {unconfirmedCount > 0 && (
              <motion.span
              key={`unconf-${unconfirmedCount}`}
              className="badge bg-melon"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              >
                {unconfirmedCount} unconfirmed
              </motion.span>
            )}
          </AnimatePresence>

          {t.status === 'ARCHIVED' && (
            <span className="badge text-bg-secondary">ARCHIVED</span>
          )}
        </Col>
      </Row>

      <div className="d-flex gap-2 mt-3">
        <Link to={`/trips/${t.id}`} className="btn btn-sm btn-primary stretched-link">
          Open
        </Link>
      </div>
    </Card>
          

        </motion.div>
  );
}

// ---- page ----
export default function Dashboard() {
  const [q, setQ] = useState('');
  const [trips, setTrips] = useState([]);
  const [metaByTrip, setMetaByTrip] = useState({});
  const [filter, setFilter] = useState('ACTIVE'); // ACTIVE | ARCHIVED | ALL

  useEffect(() => {
    seedDemoIfEmpty();
    (async () => {
      const ts = await api.listTrips();
      setTrips(ts);

      const meta = {};
      await Promise.all(
        ts.map(async (t) => {
          const full = await api.getTrip(t.id); // ensure we have members/credits
          const trip = full?.trip ? { ...full.trip, members: full.members || [] } : full || t;
          meta[t.id] = buildMeta(trip);
        })
      );
      setMetaByTrip(meta);
    })();
  }, []);

  // counts for pills
  const counts = useMemo(() => {
    const c = { ACTIVE: 0, ARCHIVED: 0, ALL: trips.length };
    trips.forEach((t) => {
      c[t.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'] += 1;
    });
    return c;
  }, [trips]);

  // filter + search
  const filtered = useMemo(() => {
    const base =
      filter === 'ALL' ? trips :
      filter === 'ACTIVE' ? trips.filter((t) => t.status !== 'ARCHIVED') :
      trips.filter((t) => t.status === 'ARCHIVED');

    if (!q.trim()) return base;
    const needle = q.trim().toLowerCase();

    return base.filter((t) => {
      const m = metaByTrip[t.id] || {};
      const hay = [
        t.title, t.shortId, t.region, t.startDate, t.endDate,
        // searchable meta
        m?.status, String(m?.confirmedCount), String(m?.unconfirmedCount)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [trips, filter, q, metaByTrip]);

  // empty state helper
  const list = Array.isArray(filtered) ? filtered : Array.isArray(trips) ? trips : [];

// logo intro animation
const [introDone, setIntroDone] = useState(false);
const handleIntroDone = useCallback(() => setIntroDone(true), []);

  return (

    <>
    {!introDone && (
      <AppLogoIntro onDone={handleIntroDone} />
    )}

{introDone && (

    <Container>
      <div className="d-flex align-items-center justify-content-between my-3">
        <h1 className="h3 mb-0">Leader Dashboard</h1>
        <Link to="/trips/new" className="btn btn-primary">Create Trip</Link>
      </div>

      <DashSearch value={q} onChange={setQ} />

      {/* Filter pills */}
      <div className="d-flex gap-2 mb-3">
        <button
          className={`btn btn-sm ${filter === 'ACTIVE' ? 'btn-secondary' : 'btn-outline-secondary'}`}
          onClick={() => setFilter('ACTIVE')}
        >
          Active ({counts.ACTIVE})
        </button>
        <button
          className={`btn btn-sm ${filter === 'ARCHIVED' ? 'btn-secondary' : 'btn-outline-secondary'}`}
          onClick={() => setFilter('ARCHIVED')}
        >
          Archived ({counts.ARCHIVED})
        </button>
        <button
          className={`btn btn-sm ${filter === 'ALL' ? 'btn-secondary' : 'btn-outline-secondary'}`}
          onClick={() => setFilter('ALL')}
        >
          All ({counts.ALL})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card p-3">
          <p className="text-muted mb-0">No trips in this view.</p>
        </div>
      ) : (
        <div className="row g-3">
          <AnimatePresence>
           
            {list.map((t, i) => (
              <motion.div key={t.id} 
              {...fadeSlide} 
              transition={{ ...(fadeSlide.transition || {}), delay: i * 0.18 }} 
              className="col-md-6">

                <TripCard t={t} meta={metaByTrip[t.id]} />

              </motion.div>
            ))}

          </AnimatePresence>
        </div>
      )}
    </Container>
          )}
    </>

  );
}
