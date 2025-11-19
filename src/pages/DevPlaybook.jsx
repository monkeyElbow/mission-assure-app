import { scenarios } from '../data/scenarios.js'
import InlineNotice from '../components/InlineNotice.jsx'

export default function DevPlaybook() {
  return (
    <div className="container" style={{ maxWidth: 960 }}>
      <h1 className="h4 mb-3">Dev Playbook</h1>
      <InlineNotice tone="info" dismissible={false} timeoutMs={null} className="mb-3">
        Scenarios for demo/support. Update <code>src/data/scenarios.js</code> to change flows or expectations. “Related tests” are optional pointers to spec names or file:line hints.
      </InlineNotice>

      <div className="d-flex flex-column gap-3">
        {scenarios.map((s, idx) => (
          <div key={idx} className="card">
            <div className="card-body">
              <h2 className="h6 mb-2">{s.title}</h2>
              <div className="small text-muted mb-2">Flow</div>
              <ol className="small ps-3">
                {(s.flow || []).map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div className="small text-muted mb-1">Expected</div>
              <div className="small mb-2">{s.expected || '—'}</div>
              {s.relatedTests?.length ? (
                <div className="small text-muted">
                  Related tests: {s.relatedTests.join(', ')}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
