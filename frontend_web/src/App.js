import React, { useMemo, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate
} from 'react-router-dom';

import './App.css';
import {
  apiLogin,
  apiMe,
  apiRegister,
  apiCreateApplication,
  apiListMyApplications,
  apiSubmitApplication,
  apiWithdrawApplication,
  apiAdminListApplications,
  apiAdminChangeStatus
} from './api/client';

// PUBLIC_INTERFACE
function App() {
  /** Root app: provides routing + lightweight auth state. */
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const [token, setToken] = useState(() => localStorage.getItem('sap_token') || '');
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(false);

  const isAuthed = Boolean(token);
  const roles = me?.roles || [];

  const isStudent = roles.includes('student');
  const isAdmin = roles.includes('admin');

  const apiBase = useMemo(() => {
    // CRA only exposes env vars prefixed with REACT_APP_
    return (process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
  }, []);

  const navigate = useNavigate();

  async function refreshMe(nextToken = token) {
    if (!nextToken) {
      setMe(null);
      return;
    }
    setLoadingMe(true);
    try {
      const data = await apiMe({ apiBase, token: nextToken });
      setMe(data);
    } catch (e) {
      // Token invalid or backend down; clear session.
      console.error(e);
      setMe(null);
      setToken('');
      localStorage.removeItem('sap_token');
    } finally {
      setLoadingMe(false);
    }
  }

  async function onLogout() {
    setToken('');
    setMe(null);
    localStorage.removeItem('sap_token');
    navigate('/login');
  }

  return (
    <div className="App">
      <TopNav
        apiBase={apiBase}
        isAuthed={isAuthed}
        loadingMe={loadingMe}
        me={me}
        isStudent={isStudent}
        isAdmin={isAdmin}
        onRefreshMe={refreshMe}
        onLogout={onLogout}
      />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home apiBase={apiBase} />} />

          <Route
            path="/login"
            element={
              isAuthed ? (
                <Navigate to={isAdmin ? '/admin' : '/student'} replace />
              ) : (
                <LoginPage apiBase={apiBase} onAuthed={async (t) => {
                  setToken(t);
                  localStorage.setItem('sap_token', t);
                  await refreshMe(t);
                  navigate('/student');
                }} />
              )
            }
          />

          <Route
            path="/register"
            element={
              isAuthed ? (
                <Navigate to="/student" replace />
              ) : (
                <RegisterPage apiBase={apiBase} onAuthed={async (t) => {
                  setToken(t);
                  localStorage.setItem('sap_token', t);
                  await refreshMe(t);
                  navigate('/student');
                }} />
              )
            }
          />

          <Route
            path="/student"
            element={
              <RequireAuth token={token}>
                <RequireRole roles={roles} role="student">
                  <StudentDashboard apiBase={apiBase} token={token} />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/admin"
            element={
              <RequireAuth token={token}>
                <RequireRole roles={roles} role="admin">
                  <AdminDashboard apiBase={apiBase} token={token} />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>

        <Footer />
      </main>
    </div>
  );
}

function TopNav({ apiBase, isAuthed, loadingMe, me, isStudent, isAdmin, onRefreshMe, onLogout }) {
  const location = useLocation();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <Link to="/" className="brand-link">Student Application Portal</Link>
          <span className="badge">API: {apiBase}</span>
        </div>

        <nav className="navlinks" aria-label="Main navigation">
          <Link className={location.pathname === '/' ? 'active' : ''} to="/">Home</Link>
          {!isAuthed && (
            <>
              <Link className={location.pathname === '/login' ? 'active' : ''} to="/login">Login</Link>
              <Link className={location.pathname === '/register' ? 'active' : ''} to="/register">Register</Link>
            </>
          )}
          {isAuthed && isStudent && (
            <Link className={location.pathname === '/student' ? 'active' : ''} to="/student">Student</Link>
          )}
          {isAuthed && isAdmin && (
            <Link className={location.pathname === '/admin' ? 'active' : ''} to="/admin">Admin</Link>
          )}
        </nav>

        <div className="nav-actions">
          {isAuthed && (
            <>
              <button className="btn btn-secondary" onClick={() => onRefreshMe()}>
                {loadingMe ? 'Refreshing…' : 'Refresh session'}
              </button>
              <button className="btn" onClick={onLogout}>Logout</button>
            </>
          )}
          {!isAuthed && <span className="muted">Not signed in</span>}
          {isAuthed && me && (
            <span className="muted">
              {me.email} ({(me.roles || []).join(', ') || 'no roles'})
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function Home({ apiBase }) {
  return (
    <section className="card">
      <h1 className="title">Welcome</h1>
      <p className="subtitle">
        This UI is wired to the backend API. Configure <code>REACT_APP_API_BASE_URL</code> to point at the backend.
      </p>
      <p className="description">
        Quick checks:
      </p>
      <ul className="list">
        <li>Backend health: <a href={`${apiBase}/`} target="_blank" rel="noreferrer">{apiBase}/</a></li>
        <li>Backend docs: <a href={`${apiBase}/docs`} target="_blank" rel="noreferrer">{apiBase}/docs</a></li>
      </ul>
    </section>
  );
}

function RequireAuth({ token, children }) {
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ roles, role, children }) {
  if (!roles.includes(role)) {
    return (
      <section className="card">
        <h2 className="title">Access denied</h2>
        <p className="description">Your account does not have the required role: <strong>{role}</strong>.</p>
        <p className="muted">If you expect access, log in with a user that has the correct role in the database.</p>
      </section>
    );
  }
  return children;
}

function LoginPage({ apiBase, onAuthed }) {
  const [email, setEmail] = useState('student1@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await apiLogin({ apiBase, email, password });
      await onAuthed(data.access_token);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h1 className="title">Login</h1>
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted">
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
    </section>
  );
}

function RegisterPage({ apiBase, onAuthed }) {
  const [email, setEmail] = useState('student1@example.com');
  const [password, setPassword] = useState('password123');
  const [firstName, setFirstName] = useState('Stu');
  const [lastName, setLastName] = useState('Dent');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await apiRegister({ apiBase, email, password, first_name: firstName, last_name: lastName });
      await onAuthed(data.access_token);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h1 className="title">Register (Student)</h1>
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>First name</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Last name</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} required />
        </label>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </section>
  );
}

function StudentDashboard({ apiBase, token }) {
  const [program, setProgram] = useState('Computer Science');
  const [term, setTerm] = useState('Fall 2026');
  const [apps, setApps] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function refresh() {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const data = await apiListMyApplications({ apiBase, token });
      setApps(data);
    } catch (e) {
      setError(e.message || 'Failed to load applications');
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const created = await apiCreateApplication({ apiBase, token, program, term });
      setInfo(`Created draft application ${created.id}`);
      await refresh();
    } catch (e) {
      setError(e.message || 'Failed to create application');
    } finally {
      setBusy(false);
    }
  }

  async function submitApp(appId) {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await apiSubmitApplication({ apiBase, token, applicationId: appId });
      setInfo(`Submitted application ${appId}`);
      await refresh();
    } catch (e) {
      setError(e.message || 'Failed to submit application');
    } finally {
      setBusy(false);
    }
  }

  async function withdrawApp(appId) {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await apiWithdrawApplication({ apiBase, token, applicationId: appId });
      setInfo(`Withdrew application ${appId}`);
      await refresh();
    } catch (e) {
      setError(e.message || 'Failed to withdraw application');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="row row-between">
        <div>
          <h1 className="title">Student Dashboard</h1>
          <p className="subtitle">Create a draft application, submit it, and track status.</p>
        </div>
        <div className="row">
          <button className="btn btn-secondary" onClick={refresh} disabled={busy}>Refresh</button>
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <h2 className="panel-title">New application</h2>
          <div className="form">
            <label className="field">
              <span>Program</span>
              <input value={program} onChange={(e) => setProgram(e.target.value)} />
            </label>
            <label className="field">
              <span>Term</span>
              <input value={term} onChange={(e) => setTerm(e.target.value)} />
            </label>
            <button className="btn btn-primary" onClick={createDraft} disabled={busy}>Create draft</button>
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">My applications</h2>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {info && <div className="alert alert-info" role="status">{info}</div>}

          {apps.length === 0 ? (
            <p className="muted">No applications loaded yet. Click Refresh.</p>
          ) : (
            <div className="table">
              <div className="table-row table-head">
                <div>ID</div>
                <div>Program</div>
                <div>Term</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              {apps.map((a) => (
                <div key={a.id} className="table-row">
                  <div className="mono">{a.id}</div>
                  <div>{a.program}</div>
                  <div>{a.term}</div>
                  <div><StatusPill status={a.status} /></div>
                  <div className="row">
                    <button
                      className="btn btn-small"
                      onClick={() => submitApp(a.id)}
                      disabled={busy || !['draft', 'needs_info'].includes(a.status)}
                    >
                      Submit
                    </button>
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => withdrawApp(a.id)}
                      disabled={busy || ['approved', 'rejected', 'withdrawn'].includes(a.status)}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AdminDashboard({ apiBase, token }) {
  const [apps, setApps] = useState([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function refresh() {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const data = await apiAdminListApplications({ apiBase, token, status: status || null, q: q || null });
      setApps(data);
    } catch (e) {
      setError(e.message || 'Failed to load applications');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(appId, toStatus) {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await apiAdminChangeStatus({ apiBase, token, applicationId: appId, to_status: toStatus, reason: null });
      setInfo(`Changed status to ${toStatus} for ${appId}`);
      await refresh();
    } catch (e) {
      setError(e.message || 'Failed to change status');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="row row-between">
        <div>
          <h1 className="title">Admin Dashboard</h1>
          <p className="subtitle">Review submissions and update statuses.</p>
        </div>
        <div className="row">
          <button className="btn btn-secondary" onClick={refresh} disabled={busy}>Refresh</button>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Filters</h2>
        <div className="row">
          <label className="field" style={{ minWidth: 220 }}>
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">(any)</option>
              <option value="draft">draft</option>
              <option value="submitted">submitted</option>
              <option value="in_review">in_review</option>
              <option value="needs_info">needs_info</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="withdrawn">withdrawn</option>
            </select>
          </label>

          <label className="field" style={{ flex: 1 }}>
            <span>Search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="program / term / student id" />
          </label>

          <button className="btn btn-primary" onClick={refresh} disabled={busy}>Apply</button>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {info && <div className="alert alert-info" role="status">{info}</div>}
      </div>

      <div className="panel">
        <h2 className="panel-title">Applications</h2>

        {apps.length === 0 ? (
          <p className="muted">No applications loaded yet. Click Refresh.</p>
        ) : (
          <div className="table">
            <div className="table-row table-head">
              <div>ID</div>
              <div>Student</div>
              <div>Program</div>
              <div>Term</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {apps.map((a) => (
              <div key={a.id} className="table-row">
                <div className="mono">{a.id}</div>
                <div className="mono">{a.student_user_id}</div>
                <div>{a.program}</div>
                <div>{a.term}</div>
                <div><StatusPill status={a.status} /></div>
                <div className="row">
                  <button
                    className="btn btn-small"
                    onClick={() => changeStatus(a.id, 'in_review')}
                    disabled={busy || !['submitted', 'needs_info'].includes(a.status)}
                  >
                    In review
                  </button>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => changeStatus(a.id, 'needs_info')}
                    disabled={busy || !['submitted', 'in_review'].includes(a.status)}
                  >
                    Needs info
                  </button>
                  <button
                    className="btn btn-small btn-primary"
                    onClick={() => changeStatus(a.id, 'approved')}
                    disabled={busy || !['in_review'].includes(a.status)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => changeStatus(a.id, 'rejected')}
                    disabled={busy || !['submitted', 'in_review', 'needs_info', 'draft'].includes(a.status)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatusPill({ status }) {
  const cls = `pill pill-${status}`;
  return <span className={cls}>{status}</span>;
}

function NotFound() {
  return (
    <section className="card">
      <h1 className="title">Not found</h1>
      <p className="description">That page does not exist.</p>
      <Link className="btn btn-secondary" to="/">Go home</Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span className="muted">
        Tip: ensure backend CORS allows this origin and that DB env vars include credentials.
      </span>
    </footer>
  );
}

export default App;
