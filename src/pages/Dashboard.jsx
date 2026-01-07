// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../data/api';
import { daysInclusive } from '../core/pricing';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeSlide } from '../ui/motion';
import DashSearch from '../components/DashSearch';
import { Container, Card, Row, Col } from 'react-bootstrap';
import AppLogoIntro from '../ui/AppLogoIntro';
import TourCallout from '../components/tour/TourCallout.jsx';

const motionRef = motion; void motionRef; // satisfy lint without react JSX plugin

// ---- helpers ----
const cents = (n = 0) =>
  (n / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

function buildMeta(trip) {
  const members = Array.isArray(trip?.members) ? trip.members : [];
  const isConfirmed = (m) => (m.isMinor ? m.guardianApproved : m.confirmed);
  const isPending = (m) => !isConfirmed(m);

  const memberCount = members.length;
  const confirmedCount = members.filter(isConfirmed).length;
  const unconfirmedCount = Math.max(0, memberCount - confirmedCount);
  const pendingCount = members.filter(isPending).length;

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
    pendingCount,
  };
}

// ---- card ----
function TripCard({ t, meta = {} }) {
  const {
    memberCount = 0,
    confirmedCount = 0,
    unconfirmedCount = 0,
    pendingCount = 0,
    balanceDueCents = 0,
    status = 'SETUP',
  } = meta;

  const days = daysInclusive(t.startDate, t.endDate) || 0;
  const isArchived = t.status === 'ARCHIVED';

  return (
    <motion.div className="h-100" layout>
      <Card className={`leader-trip-card p-4 h-100 position-relative ${isArchived ? 'archived-card' : ''}`}>
        <h2 className="h4 mb-2">{t.title}</h2>
        <Row className="g-2 align-items-start">
          <Col md={12} className="d-flex flex-column gap-2">
            <div className="d-flex flex-wrap align-items-center gap-2">
              {t.shortId && <span className="fw-semibold text-muted small">#{t.shortId}</span>}
              <span className="badge bg-dark small">{t.region}</span>
            </div>
            <div className="small text-muted lh-sm d-flex align-items-center gap-2 flex-wrap">
              <span>{t.startDate} → {t.endDate}</span>
              <span className="badge bg-light text-dark border">{days} days</span>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2 small text-muted lh-sm">
              <span
                className="badge bg-light fw-semibold"
                style={{ color: 'var(--agf1)', border: '1px solid var(--agf1)' }}
              >
                {confirmedCount}/{memberCount} confirmed
              </span>
              {!isArchived && (
                <>
                  <span className="badge bg-agf1 text-white">Ready: {confirmedCount}</span>
                  {pendingCount > 0 && (
                    <span className="badge bg-warning text-dark">Pending: {pendingCount}</span>
                  )}
                </>
              )}
              {!isArchived && status === 'DUE' && (
                <motion.span
                  key="due"
                  className="badge bg-melon text-dark"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  Pay {cents(balanceDueCents)}
                </motion.span>
              )}
              <AnimatePresence>
                {!isArchived && unconfirmedCount > 0 && (
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
              {isArchived && <span className="badge text-bg-secondary">ARCHIVED</span>}
              {!isArchived && memberCount === 0 && (
                <span className="badge text-bg-light text-muted">Ready to add people</span>
              )}
            </div>
            <div className="pt-3 mt-2 border-top text-center">
              <Link to={`/trips/${t.id}`} className="btn btn-sm btn-primary px-4 stretched-link">
                Open
              </Link>
            </div>
          </Col>
        </Row>
      </Card>
    </motion.div>
  );
}

// ---- page ----
export default function Dashboard() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [trips, setTrips] = useState([]);
  const [metaByTrip, setMetaByTrip] = useState({});
  const [filter, setFilter] = useState('ACTIVE'); // ACTIVE | ARCHIVED | ALL

  useEffect(() => {
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
        <Link
          to="/trips/new"
          className="btn btn-primary"
        >
          Create Trip
        </Link>
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
          <TourCallout
            title="Add your first trip"
            description="Start by creating a trip. We’ll walk you through payments, claims, and rosters next."
            stepLabel="Get started"
            actionLabel="Create trip"
            onAction={() => navigate('/trips/new')}
            onDismiss={() => {}}
            showTurnOff={false}
          />
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
