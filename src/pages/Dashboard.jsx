// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../data/api';
import { daysInclusive } from '../core/pricing';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeSlide } from '../ui/motion';
import DashSearch from '../components/DashSearch';
import { Container, Card } from 'react-bootstrap';
import AppLogoIntro from '../ui/AppLogoIntro';
import TourCallout from '../components/tour/TourCallout.jsx';
import playBarcode from '../assets/play-bar-code.svg';

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
    readyCount = 0,
    balanceDueCents = 0,
  } = meta;

  const days = daysInclusive(t.startDate, t.endDate) || 0;
  const isArchived = t.status === 'ARCHIVED';

  return (
    <motion.div className="h-100" layout>
      <Link to={`/trips/${t.id}`} className="trip-card-link" aria-label={`Open ${t.title}`}>
        <Card className={`leader-trip-card h-100 position-relative ${isArchived ? 'archived-card' : ''}`}>
          <img className="trip-card-barcode" src={playBarcode} alt="" aria-hidden="true" />
          <div className="trip-card-header">
            <div className="trip-card-dates">{t.startDate} → {t.endDate}</div>
            <div className="trip-card-days">{days} days</div>
          </div>
          <div className="trip-card-inner">
            <div className="trip-card-stats">
              <div className="trip-card-stat">
                <div className="trip-card-stat-label">Travelers</div>
                <div className="trip-card-stat-value">{memberCount}</div>
              </div>
              <div className="trip-card-stat">
                <div className="trip-card-stat-label">Confirmed</div>
                <div className="trip-card-stat-value">{confirmedCount}</div>
              </div>
              <div className="trip-card-stat">
                <div className="trip-card-stat-label">Ready</div>
                <div className="trip-card-stat-value">{readyCount}</div>
              </div>
            </div>
            <div className="trip-card-destination">
              <div className="trip-card-destination-label">Destination</div>
              <div className="trip-card-destination-divider" />
              <div className="trip-card-title">{t.title}</div>
            </div>
          </div>
          <div className="trip-card-footer">
            <div className="trip-card-amount">
              <span className="trip-card-amount-label">Amount due:</span>
              <span
                className={`trip-card-amount-value ${balanceDueCents <= 0 ? 'is-paid' : ''}`}
              >
                {balanceDueCents <= 0 ? 'PAID' : cents(balanceDueCents)}
              </span>
            </div>
            <div className="trip-card-meta">
              <span className="trip-card-region">{(t.region || 'Domestic').toUpperCase()}</span>
              {t.shortId && <span className="trip-card-id">#{t.shortId}</span>}
            </div>
          </div>
        </Card>
      </Link>
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
          const summary = await api.getRosterSummary?.(t.id).catch(() => null);
          const readyCount = summary?.ready_roster?.length || 0;
          meta[t.id] = { ...buildMeta(trip), readyCount };
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
              className="col-lg-6">

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
