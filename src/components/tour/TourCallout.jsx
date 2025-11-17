export default function TourCallout({
  title,
  description,
  stepLabel,
  actionLabel,
  onAction,
  onDismiss,
  onTurnOff,
  className = '',
  dismissLabel = 'Dismiss',
  showTurnOff = true,
}) {
  return (
    <div className={`tour-callout card shadow-sm ${className}`}>
      {showTurnOff && onTurnOff && (
        <div className="position-absolute end-0 top-0 pe-2 pt-2">
          <button
            type="button"
            className="btn btn-link btn-sm text-decoration-none px-1 py-0 small"
            onClick={onTurnOff}
          >
            Turn off tour
          </button>
        </div>
      )}
      <div className="small text-muted fw-semibold mb-1">{stepLabel}</div>
      {title && <div className="fw-semibold mb-1">{title}</div>}
      {description && <p className="mb-3 small text-muted">{description}</p>}
      <div className="d-flex flex-wrap gap-2">
        {actionLabel && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onDismiss}>
          {dismissLabel || 'Dismiss'}
        </button>
      </div>
    </div>
  );
}
