import { useEffect, useState } from 'react';
import { api } from '../data/api';
import InlineNotice from '../components/InlineNotice.jsx';

const emptyForm = {
  firstName: '',
  lastName: '',
  title: '',
  email: '',
  phone: '',
  churchName: '',
  legalName: '',
  ein: '',
  churchPhone: '',
  churchAddress1: '',
  churchAddress2: '',
  churchCity: '',
  churchState: '',
  churchPostal: '',
  churchCountry: '',
  mailingAddress1: '',
  mailingAddress2: '',
  mailingCity: '',
  mailingState: '',
  mailingPostal: '',
  mailingCountry: ''
};

export default function Account(){
  const [leader, setLeader] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      setErr('');
      try {
        const current = await api.getCurrentLeader();
        if (!current) {
          setErr('No leader account found.');
          return;
        }
        setLeader(current);
        setForm({ ...emptyForm, ...current });
      } catch (e) {
        setErr(e?.message || 'Unable to load account.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateField(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function copyChurchToMailing() {
    setForm(prev => ({
      ...prev,
      mailingAddress1: prev.churchAddress1,
      mailingAddress2: prev.churchAddress2,
      mailingCity: prev.churchCity,
      mailingState: prev.churchState,
      mailingPostal: prev.churchPostal,
      mailingCountry: prev.churchCountry
    }));
  }

  async function save(e) {
    e.preventDefault();
    if (!leader) return;
    setErr('');
    setMsg('');
    try {
      const saved = await api.updateLeader(leader.id, form);
      setLeader(saved);
      setMsg('Account updated.');
    } catch (e) {
      setErr(e?.message || 'Unable to save account.');
    }
  }

  return (
    <div className="container my-4" style={{ maxWidth: 980 }}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Leader Account</h1>
          <div className="text-muted small">Demo account is pre-created for faster walkthroughs.</div>
        </div>
      </div>

      {err && (
        <InlineNotice tone="danger" dismissible className="mb-3">
          {err}
        </InlineNotice>
      )}
      {msg && (
        <InlineNotice tone="success" dismissible className="mb-3">
          {msg}
        </InlineNotice>
      )}

      {loading ? (
        <div className="text-muted">Loading account…</div>
      ) : (
        <form onSubmit={save} className="d-grid gap-3">
          <div className="card">
            <div className="card-header fw-semibold">Leader details</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">First name</label>
                  <input className="form-control" value={form.firstName} onChange={updateField('firstName')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Last name</label>
                  <input className="form-control" value={form.lastName} onChange={updateField('lastName')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Title</label>
                  <input className="form-control" value={form.title} onChange={updateField('title')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={form.email} onChange={updateField('email')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={updateField('phone')} />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header fw-semibold">Church details</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Church name</label>
                  <input className="form-control" value={form.churchName} onChange={updateField('churchName')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Church phone</label>
                  <input className="form-control" value={form.churchPhone} onChange={updateField('churchPhone')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Address line 1</label>
                  <input className="form-control" value={form.churchAddress1} onChange={updateField('churchAddress1')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Address line 2</label>
                  <input className="form-control" value={form.churchAddress2} onChange={updateField('churchAddress2')} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">City</label>
                  <input className="form-control" value={form.churchCity} onChange={updateField('churchCity')} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">State</label>
                  <input className="form-control" value={form.churchState} onChange={updateField('churchState')} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Postal code</label>
                  <input className="form-control" value={form.churchPostal} onChange={updateField('churchPostal')} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Country</label>
                  <input className="form-control" value={form.churchCountry} onChange={updateField('churchCountry')} />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header fw-semibold">Legal details</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Legal organization name</label>
                  <input className="form-control" value={form.legalName} onChange={updateField('legalName')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">EIN / Tax ID</label>
                  <input className="form-control" value={form.ein} onChange={updateField('ein')} />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header fw-semibold d-flex flex-wrap align-items-center justify-content-between gap-2">
              <span>Mailing address</span>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copyChurchToMailing}>
                Copy church address
              </button>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Address line 1</label>
                  <input className="form-control" value={form.mailingAddress1} onChange={updateField('mailingAddress1')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Address line 2</label>
                  <input className="form-control" value={form.mailingAddress2} onChange={updateField('mailingAddress2')} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">City</label>
                  <input className="form-control" value={form.mailingCity} onChange={updateField('mailingCity')} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">State</label>
                  <input className="form-control" value={form.mailingState} onChange={updateField('mailingState')} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Postal code</label>
                  <input className="form-control" value={form.mailingPostal} onChange={updateField('mailingPostal')} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Country</label>
                  <input className="form-control" value={form.mailingCountry} onChange={updateField('mailingCountry')} />
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end">
            <button className="btn btn-primary" type="submit">Save changes</button>
          </div>
        </form>
      )}
    </div>
  );
}
