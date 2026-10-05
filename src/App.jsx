import { useCallback, useEffect, useState } from 'react';

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const emptyProduct = { name: '', description: '', price: '', stock: '0' };

async function request(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const token = sessionStorage.getItem('access_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));

  if (response.status === 401 && retry && sessionStorage.getItem('refresh_token') && path !== '/auth/refresh') {
    const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: sessionStorage.getItem('refresh_token') }),
    });

    const refreshBody = await refreshResponse.json().catch(() => ({}));
    if (refreshResponse.ok && refreshBody.tokens) {
      sessionStorage.setItem('access_token', refreshBody.tokens.access_token);
      sessionStorage.setItem('refresh_token', refreshBody.tokens.refresh_token);
      return request(path, options, false);
    }

    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    window.dispatchEvent(new Event('auth-expired'));
  }

  if (!response.ok) {
    throw new Error(body.error || 'Request failed. Please try again.');
  }

  return body;
}

function Icon({ name, size = 18 }) {
  const paths = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8m-9 5v9" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    arrow: <><path d="M5 12h14m-7-7 7 7-7 7" /></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Login({ onLogin }) {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const result = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: identity, password }),
      }, false);
      sessionStorage.setItem('access_token', result.tokens.access_token);
      sessionStorage.setItem('refresh_token', result.tokens.refresh_token);
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-story">
        <a className="brand brand-light" href="/" aria-label="Fieldnotes home">
          <span className="brand-mark"><Icon name="box" size={19} /></span>
          <span>fieldnotes<span className="brand-period">.</span></span>
        </a>
        <div className="story-copy">
          <span className="eyebrow eyebrow-light">THE SMALL THINGS, IN ORDER</span>
          <h1>A clearer view<br />of what you carry.</h1>
          <p>Thoughtful tools for keeping your product collection exactly where it should be.</p>
        </div>
        <div className="story-bottom"><span>INVENTORY, WITH INTENTION</span><span>01 — 03</span></div>
      </section>

      <section className="login-panel">
        <div className="login-mobile-brand">
          <a className="brand" href="/"><span className="brand-mark"><Icon name="box" size={19} /></span><span>fieldnotes<span className="brand-period">.</span></span></a>
        </div>
        <div className="login-form-wrap">
          <span className="eyebrow">YOUR PRIVATE WORKSPACE</span>
          <h2>Welcome back.</h2>
          <p className="form-intro">Sign in to pick up where you left off.</p>
          <form onSubmit={submit}>
            <label htmlFor="identity">Email or username</label>
            <input id="identity" autoComplete="username" value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="you@example.com" required />
            <div className="label-row"><label htmlFor="password">Password</label></div>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
            {error && <div className="alert" role="alert">{error}</div>}
            <button className="button button-primary login-submit" disabled={busy}>
              {busy ? 'Signing in…' : <>Sign in <Icon name="arrow" size={17} /></>}
            </button>
          </form>
          <div className="login-footnote"><span className="secure-dot" /> Your inventory is private and secure.</div>
        </div>
        <footer className="login-footer"><span>FIELDNOTES INVENTORY</span><span>MADE FOR THE WAY YOU WORK</span></footer>
      </section>
    </main>
  );
}

function ProductDialog({ product, onClose, onSave }) {
  const [form, setForm] = useState(product || emptyProduct);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        stock: Number(form.stock),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-head">
          <div><span className="eyebrow">{product ? 'REFINE YOUR RECORD' : 'ADD TO YOUR COLLECTION'}</span><h2 id="dialog-title">{product ? 'Edit product' : 'New product'}</h2></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="product-name">Product name</label>
          <input id="product-name" name="name" value={form.name} onChange={change} placeholder="e.g. Everyday Tote" maxLength={255} required autoFocus />
          <label htmlFor="product-description">Description <span className="optional">OPTIONAL</span></label>
          <textarea id="product-description" name="description" value={form.description || ''} onChange={change} placeholder="A few details worth remembering…" rows="3" />
          <div className="form-columns">
            <div><label htmlFor="product-price">Price</label><div className="input-prefix"><span>$</span><input id="product-price" name="price" type="number" min="0" step="0.01" value={form.price} onChange={change} placeholder="0.00" required /></div></div>
            <div><label htmlFor="product-stock">Quantity</label><input id="product-stock" name="stock" type="number" min="0" step="1" value={form.stock} onChange={change} required /></div>
          </div>
          {error && <div className="alert" role="alert">{error}</div>}
          <div className="dialog-actions">
            <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
            <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [products, setProducts] = useState([]);
  const [dialogProduct, setDialogProduct] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await request('/products');
      setProducts(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  async function saveProduct(values) {
    const editing = dialogProduct && dialogProduct !== 'new';
    const path = editing ? `/products/${dialogProduct.id}` : '/products';
    await request(path, {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(values),
    });
    setDialogProduct(undefined);
    setNotice(editing ? 'Changes saved.' : 'Product added to your collection.');
    await loadProducts();
  }

  async function removeProduct(product) {
    if (!window.confirm(`Remove “${product.name}” from your collection?`)) return;
    setError('');
    try {
      await request(`/products/${product.id}`, { method: 'DELETE' });
      setNotice('Product removed.');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function logout() {
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: sessionStorage.getItem('refresh_token') }),
      });
    } catch (err) {
      console.error('Logout request failed; clearing the local session.', err);
    } finally {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      onLogout();
    }
  }

  const totalValue = products.reduce((sum, product) => sum + Number(product.price) * Number(product.stock), 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/"><span className="brand-mark"><Icon name="box" size={19} /></span><span>fieldnotes<span className="brand-period">.</span></span></a>
        <div className="topbar-right"><div className="user-badge"><span className="avatar">{(user.username || user.email || 'U').slice(0, 1).toUpperCase()}</span><span className="user-name">{user.username || user.email}</span></div><span className="topbar-divider" /><button className="logout-button" onClick={logout}><Icon name="logout" size={16} /><span>Log out</span></button></div>
      </header>

      <main className="content">
        <div className="page-heading">
          <div><div className="breadcrumb"><span>WORKSPACE</span><i>/</i><span className="breadcrumb-current">PRODUCTS</span></div><h1>Your collection<span className="heading-period">.</span></h1><p>A considered home for everything you make and keep.</p></div>
          <button className="button button-primary add-button" onClick={() => setDialogProduct('new')}><Icon name="plus" size={17} /> Add product</button>
        </div>

        <section className="overview" aria-label="Collection summary">
          <div className="overview-item"><span className="overview-label">IN YOUR COLLECTION</span><strong>{loading ? '—' : String(products.length).padStart(2, '0')}</strong><span className="overview-note">tracked products</span></div>
          <div className="overview-rule" />
          <div className="overview-item"><span className="overview-label">TOTAL UNITS</span><strong>{loading ? '—' : products.reduce((sum, product) => sum + Number(product.stock), 0).toLocaleString()}</strong><span className="overview-note">across your collection</span></div>
          <div className="overview-rule" />
          <div className="overview-item"><span className="overview-label">STOCK VALUE</span><strong>{loading ? '—' : `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><span className="overview-note">at current inventory</span></div>
        </section>

        <div className="section-heading"><div><span className="eyebrow">THE DETAILS</span><h2>All products <span className="count-pill">{products.length}</span></h2></div><span className="sort-note">MOST RECENT FIRST</span></div>

        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><Icon name="close" size={15} /></button></div>}
        {error && <div className="alert page-alert" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close" size={15} /></button></div>}

        {loading ? <div className="loading-state"><span className="spinner" /> Gathering your collection…</div> : products.length === 0 ? (
          <div className="empty-state"><span className="empty-icon"><Icon name="box" size={24} /></span><h3>A little room for something new.</h3><p>Your collection is empty. Add your first product to get started.</p><button className="button button-primary" onClick={() => setDialogProduct('new')}><Icon name="plus" size={16} /> Add your first product</button></div>
        ) : (
          <div className="product-grid">
            {products.map((product, index) => (
              <article className="product-card" key={product.id}>
                <div className={`product-art art-${index % 5}`}><span className="product-number">NO. {String(product.id).padStart(3, '0')}</span><span className="product-art-icon"><Icon name="box" size={38} /></span><span className="stock-tag">{Number(product.stock) > 0 ? `${product.stock} IN STOCK` : 'OUT OF STOCK'}</span></div>
                <div className="product-info"><div className="product-copy"><h3>{product.name}</h3><p>{product.description || 'No description added.'}</p></div><div className="product-meta"><strong>${Number(product.price).toFixed(2)}</strong><div className="card-actions"><button className="icon-button" aria-label={`Edit ${product.name}`} onClick={() => setDialogProduct(product)}><Icon name="edit" size={16} /></button><button className="icon-button icon-danger" aria-label={`Delete ${product.name}`} onClick={() => removeProduct(product)}><Icon name="trash" size={16} /></button></div></div></div>
              </article>
            ))}
          </div>
        )}

        <footer className="page-footer"><span>FIELDNOTES — YOUR COLLECTION, CONSIDERED.</span><span>SHOWING {products.length} {products.length === 1 ? 'PRODUCT' : 'PRODUCTS'}</span></footer>
      </main>

      {dialogProduct !== undefined && <ProductDialog product={dialogProduct === 'new' ? null : dialogProduct} onClose={() => setDialogProduct(undefined)} onSave={saveProduct} />}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    function expireSession() {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      setUser(null);
    }
    window.addEventListener('auth-expired', expireSession);
    return () => window.removeEventListener('auth-expired', expireSession);
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem('access_token') && !sessionStorage.getItem('refresh_token')) {
      setCheckingSession(false);
      return;
    }

    request('/auth/me')
      .then((result) => setUser(result.user))
      .catch((err) => {
        console.error('Could not restore the saved session.', err);
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
      })
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return <div className="loading-state session-loading"><span className="spinner" /> Restoring your workspace…</div>;
  }

  return user
    ? <Dashboard user={user} onLogout={() => setUser(null)} />
    : <Login onLogin={setUser} />;
}
