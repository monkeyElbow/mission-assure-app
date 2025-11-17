import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'missionassure.tour.v1';

const defaultSteps = () => ({
  dashboardIntro: true, // dashboard tip is now standalone; keep tour flow to trip pages
  paymentSummary: false,
  claims: false,
  spotOverview: false,
  readyRoster: false,
  pendingCoverage: false,
});

const initialState = () => ({ enabled: true, steps: defaultSteps() });

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return initialState();
    const steps = { ...defaultSteps(), ...(parsed.steps || {}) };
    // dashboard tip no longer part of tour flow; force it done to allow completion
    steps.dashboardIntro = true;
    return {
      enabled: parsed.enabled !== false,
      steps,
    };
  } catch {
    return initialState();
  }
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

const TourContext = createContext(null);

export function TourProvider({ children }) {
  const [state, setState] = useState(() => loadState());

  useEffect(() => { persist(state); }, [state]);

  const enableTour = useCallback((resetSteps = true) => {
    setState((prev) => ({
      enabled: true,
      steps: resetSteps ? defaultSteps() : { ...defaultSteps(), ...(prev.steps || {}) },
    }));
  }, []);

  const disableTour = useCallback(() => {
    setState((prev) => ({ ...prev, enabled: false }));
  }, []);

  const completeStep = useCallback((stepKey) => {
    if (!stepKey) return;
    setState((prev) => {
      const steps = { ...defaultSteps(), ...(prev.steps || {}), [stepKey]: true };
      const allDone = Object.values(steps).every(Boolean);
      return { ...prev, steps, enabled: allDone ? false : prev.enabled };
    });
  }, []);

  const resetTour = useCallback(() => setState(initialState()), []);

  const value = useMemo(() => {
    const stepOrder = ['dashboardIntro', 'paymentSummary', 'claims', 'spotOverview', 'readyRoster', 'pendingCoverage'];
    return {
      enabled: state.enabled,
      steps: state.steps,
      activeStep: state.enabled ? stepOrder.find((key) => !state.steps?.[key]) : null,
      enableTour,
      disableTour,
      completeStep,
      dismissStep: completeStep,
      resetTour,
      stepOrder,
      isStepOpen: (key) => state.enabled && !state.steps?.[key],
    };
  }, [state, enableTour, disableTour, completeStep, resetTour]);

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
}
