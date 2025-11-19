import { useEffect, useState } from 'react';

const toneStyles = {
  info: 'agf-alert-info',
  success: 'agf-alert-success',
  danger: 'agf-alert-danger',
  warning: 'agf-alert-warning'
};

export default function InlineNotice({
  tone = 'info',
  dismissible = true,
  timeoutMs = 4000,
  className = '',
  children
}) {
  const [open, setOpen] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!timeoutMs) return;
    const id = setTimeout(() => triggerClose(), timeoutMs);
    return () => clearTimeout(id);
  }, [timeoutMs]);

  const triggerClose = () => {
    setClosing(true);
    setTimeout(() => setOpen(false), 180);
  };

  if (!open) return null;

  const toneClass = toneStyles[tone] || toneStyles.info;

  return (
    <div className={`agf-alert ${toneClass} ${closing ? 'agf-alert-closing' : ''} ${className}`} role="status">
      <div className="agf-alert__body">{children}</div>
      {dismissible && (
        <button
          type="button"
          className="agf-alert__close"
          aria-label="Close message"
          onClick={triggerClose}
        >
          ×
        </button>
      )}
    </div>
  );
}
