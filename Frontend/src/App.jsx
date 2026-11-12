
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight,
  BadgeCheck, BookOpen, Check, CheckCircle2, ChevronDown, CircleHelp,
  Clock3, FileCheck2, FileText, Filter, Gauge, LayoutDashboard,
  LoaderCircle, Menu, Plus, RefreshCw, Search, Shield, ShieldAlert,
  ShieldCheck, Sparkles, X, Zap, Upload, Image, File
} from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
];

const cx = (...v) => v.filter(Boolean).join(' ');

const date = value =>
  value
    ? new Date(value).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : '—';

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

function App() {
  const [page, setPage] = useState('overview');
  const [brands, setBrands] = useState([]);
  const [audits, setAudits] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [health, setHealth] = useState('checking');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState('');
  const [auditContent, setAuditContent] = useState('');
  const [auditFile, setAuditFile] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [showBrandForm, setShowBrandForm] = useState(false);

  const [brandForm, setBrandForm] = useState({
    name: '',
    description: '',
    toneOfVoice: '',
    rule: '',
    approvedFact: '',
    approvedTerms: '',
    prohibitedTerms: ''
  });

  const [savingBrand, setSavingBrand] = useState(false);
  const [reviewBusy, setReviewBusy] = useState('');

  const notify = (type, message) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 4200);
  };

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const [b, a] = await Promise.all([
        request('/brands'),
        request('/audits')
      ]);

      setBrands(b.brands || []);
      setAudits(a.audits || []);

      setSelectedBrand(current => current || b.brands?.[0]?._id || '');
      setHealth('online');
    } catch (e) {
      setHealth('offline');
      notify('error', `${e.message}. Check that the backend is running on port 5000.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentBrand =
    brands.find(b => b._id === selectedBrand) || brands[0];

  const stats = useMemo(() => ({
    total: audits.length,
    flagged: audits.filter(a => a.overallStatus === 'non_compliant').length,
    review: audits.filter(a => a.overallStatus === 'needs_review').length,
    pending: audits.reduce(
      (n, a) =>
        n + (a.findings || []).filter(f => f.reviewStatus === 'pending').length,
      0
    )
  }), [audits]);

  const filteredAudits = audits.filter(a =>
    `${a.brand?.name || ''} ${a.submittedContent || ''} ${a.overallStatus || ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  async function createBrand(e) {
    e.preventDefault();
    setSavingBrand(true);

    try {
      const payload = {
        name: brandForm.name,
        description: brandForm.description,
        toneOfVoice: brandForm.toneOfVoice,
        rules: brandForm.rule
          ? [{
              category: 'Brand standards',
              rule: brandForm.rule,
              severity: 'high'
            }]
          : [],
        approvedFacts: brandForm.approvedFact
          ? [{
              fact: brandForm.approvedFact,
              source: 'Brand profile'
            }]
          : [],
        approvedTerms: brandForm.approvedTerms
          .split(',')
          .map(x => x.trim())
          .filter(Boolean),
        prohibitedTerms: brandForm.prohibitedTerms
          .split(',')
          .map(x => x.trim())
          .filter(Boolean)
      };

      const result = await request('/brands', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setBrands(old => [result.brand, ...old]);
      setSelectedBrand(result.brand._id);
      setShowBrandForm(false);

      setBrandForm({
        name: '',
        description: '',
        toneOfVoice: '',
        rule: '',
        approvedFact: '',
        approvedTerms: '',
        prohibitedTerms: ''
      });

      notify('success', 'Brand profile created.');
      setPage('brands');
    } catch (e) {
      notify('error', e.message);
    } finally {
      setSavingBrand(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];

    if (!file) {
      setAuditFile(null);
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      notify('error', 'Only JPG, PNG, WEBP and PDF files are allowed.');
      e.target.value = '';
      setAuditFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      notify('error', 'File size must be 10 MB or less.');
      e.target.value = '';
      setAuditFile(null);
      return;
    }

    setAuditFile(file);
  }

  async function runAudit(e) {
    e.preventDefault();

    if (!selectedBrand || (!auditContent.trim() && !auditFile)) {
      notify('error', 'Enter content or select an image/PDF.');
      return;
    }

    setAuditing(true);
    setAuditResult(null);

    try {
      let body;
      let headers = {};

      if (auditFile) {
        body = new FormData();
        body.append('brandId', selectedBrand);
        body.append('file', auditFile);

        if (auditContent.trim()) {
          body.append('content', auditContent);
        }
      } else {
        body = JSON.stringify({
          brandId: selectedBrand,
          content: auditContent
        });

        headers['Content-Type'] = 'application/json';
      }

      const result = await request('/audits/check', {
        method: 'POST',
        headers,
        body
      });

      setAuditResult(result.audit);
      setAudits(old => [result.audit, ...old]);

      setAuditContent('');
      setAuditFile(null);

      const fileInput = document.getElementById('audit-file-input');
      if (fileInput) fileInput.value = '';

      notify('success', 'Content audit completed and saved.');
    } catch (e) {
      notify('error', e.message);
    } finally {
      setAuditing(false);
    }
  }

  async function review(auditId, findingId, decision) {
    const key = `${findingId}-${decision}`;
    setReviewBusy(key);

    try {
      await request(
        `/audits/${auditId}/findings/${findingId}/review`,
        {
          method: 'PATCH',
          body: JSON.stringify({ decision })
        }
      );

      const data = await request('/audits');
      const updatedAudits = data.audits || [];

      setAudits(updatedAudits);

      const updatedAudit = updatedAudits.find(
        a => a._id === auditId
      );

      if (updatedAudit) {
        setAuditResult(updatedAudit);
      }

      notify('success', `Finding ${decision}.`);
    } catch (e) {
      notify('error', e.message);
    } finally {
      setReviewBusy('');
    }
  }

  const nav = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'audit', label: 'Content audit', icon: Sparkles },
    { id: 'brands', label: 'Brand profiles', icon: BookOpen },
    { id: 'history', label: 'Audit history', icon: FileCheck2 }
  ];

  return (
    <div className="app-shell">

      <aside className={cx('sidebar', mobileNav && 'sidebar-open')}>
        <div className="brand-lockup">
          <div className="logo"><ShieldCheck size={22} /></div>
          <div>
            <strong>brandguard<span>ai</span></strong>
            <small>BRAND GOVERNANCE</small>
          </div>
          <button className="icon-btn close-nav" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace">
          <div className="workspace-mark">A</div>
          <div>
            <b>ARJUNA workspace</b>
            <small>Free workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">PLATFORM</div>
        <nav>
          {nav.map(item => (
            <button
              key={item.id}
              className={cx('nav-item', page === item.id && 'active')}
              onClick={() => {
                setPage(item.id);
                setMobileNav(false);
              }}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === 'history' && stats.pending > 0 && (
                <em>{stats.pending}</em>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="side-tip">
            <div className="tip-icon"><Zap size={16} /></div>
            <b>Brand consistency, at scale.</b>
            <p>Keep every message aligned with what your brand stands for.</p>
            <button onClick={() => setPage('brands')}>
              Manage guidelines <ArrowRight size={14} />
            </button>
          </div>

          <div className="profile">
            <div className="avatar">DV</div>
            <div>
              <b>Dhruv Vishwakarma</b>
              <small>Workspace admin</small>
            </div>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>

      {mobileNav && (
        <div className="scrim" onClick={() => setMobileNav(false)} />
      )}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMobileNav(true)}>
            <Menu />
          </button>

          <div className="crumb">
            Workspace <span>/</span>
            <b>{nav.find(n => n.id === page)?.label || 'Overview'}</b>
          </div>

          <div className="top-actions">
            <div className={cx('connection', health)}>
              <i />
              {health === 'online'
                ? 'API connected'
                : health === 'checking'
                  ? 'Connecting…'
                  : 'API offline'}
            </div>

            <button className="icon-btn" title="Refresh data" onClick={refresh}>
              <RefreshCw size={17} />
            </button>

            <div className="top-avatar">DV</div>
          </div>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" /> BRAND INTELLIGENCE PLATFORM
              </div>

              <h1>
                {page === 'overview'
                  ? 'Good to see you, Dhruv.'
                  : page === 'audit'
                    ? 'Content audit'
                    : page === 'brands'
                      ? 'Brand profiles'
                      : 'Audit history'}
              </h1>

              <p>
                {page === 'overview'
                  ? 'Your brand standards, protected across every channel.'
                  : page === 'audit'
                    ? 'Check marketing content against your approved brand intelligence.'
                    : page === 'brands'
                      ? 'Define the rules, facts and language that make your brand yours.'
                      : 'Review past checks, findings and human decisions.'}
              </p>
            </div>

            {page !== 'audit' && (
              <button
                className="btn btn-primary"
                onClick={() =>
                  page === 'brands' ? setShowBrandForm(true) : setPage('audit')
                }
              >
                <Plus size={17} />
                {page === 'brands' ? 'Add brand' : 'New audit'}
              </button>
            )}
          </div>

          {page === 'overview' && (
            <>
              <div className="welcome-banner">
                <div className="banner-orb orb-one" />
                <div className="banner-orb orb-two" />

                <div className="banner-copy">
                  <div className="banner-kicker">
                    <Sparkles size={14} /> YOUR BRAND, IN GOOD HANDS
                  </div>

                  <h2>
                    One brand. One standard.<br />
                    <span>Every channel.</span>
                  </h2>

                  <p>
                    BrandGuard AI helps your team catch off-brand messaging
                    and unsupported claims before they go live.
                  </p>

                  <button className="btn btn-light" onClick={() => setPage('audit')}>
                    Audit content <ArrowRight size={16} />
                  </button>
                </div>

                <div className="banner-visual">
                  <div className="orbit orbit-a" />
                  <div className="orbit orbit-b" />
                  <div className="shield-glow"><ShieldCheck size={62} /></div>
                  <div className="float-chip chip-top">
                    <CheckCircle2 size={15} /> Brand aligned
                  </div>
                  <div className="float-chip chip-bottom">
                    <Sparkles size={15} /> AI powered review
                  </div>
                </div>
              </div>

              <div className="section-head">
                <div>
                  <h2>Workspace pulse</h2>
                  <p>A snapshot of your brand governance activity.</p>
                </div>
                <span className="muted-small">
                  ALL TIME <span className="live-dot" />
                </span>
              </div>

              <div className="stat-grid">
                <Stat icon={FileText} label="Total audits" value={stats.total} note="Content checks completed" tone="blue" />
                <Stat icon={ShieldAlert} label="Flagged content" value={stats.flagged} note="Requires attention" tone="red" />
                <Stat icon={Clock3} label="Needs review" value={stats.review} note="Awaiting a decision" tone="amber" />
                <Stat icon={Activity} label="Pending findings" value={stats.pending} note="Human review required" tone="violet" />
              </div>

              <div className="two-col">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Recent audits</h3>
                      <p>Your latest content checks</p>
                    </div>
                    <button className="text-btn" onClick={() => setPage('history')}>
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  <AuditList
                    audits={audits.slice(0, 4)}
                    onOpen={a => {
                      setAuditResult(a);
                      setPage('history');
                    }}
                  />
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Brand profiles</h3>
                      <p>Guidelines connected to your workspace</p>
                    </div>
                    <button className="text-btn" onClick={() => setPage('brands')}>
                      Manage <ArrowRight size={14} />
                    </button>
                  </div>

                  {brands.length
                    ? brands.slice(0, 4).map(b => (
                        <BrandRow
                          key={b._id}
                          brand={b}
                          onClick={() => {
                            setSelectedBrand(b._id);
                            setPage('brands');
                          }}
                        />
                      ))
                    : (
                        <Empty
                          icon={BookOpen}
                          title="No brand profiles yet"
                          text="Add your first brand to start auditing content."
                          action="Create brand"
                          onAction={() => setShowBrandForm(true)}
                        />
                      )}
                </section>
              </div>
            </>
          )}

          {page === 'audit' && (
            <div className="audit-layout">
              <section className="panel audit-form-panel">
                <div className="panel-head">
                  <div>
                    <h3>Submit content for review</h3>
                    <p>Paste text or upload an image/PDF to check against your brand.</p>
                  </div>
                  <div className="ai-pill"><Sparkles size={14} /> AI REVIEW</div>
                </div>

                {!brands.length ? (
                  <Empty
                    icon={BookOpen}
                    title="Create a brand profile first"
                    text="BrandGuard needs approved rules and facts to evaluate your content."
                    action="Create brand profile"
                    onAction={() => setShowBrandForm(true)}
                  />
                ) : (
                  <form onSubmit={runAudit}>
                    <label className="field-label">BRAND PROFILE</label>
                    <select
                      className="input"
                      value={selectedBrand}
                      onChange={e => setSelectedBrand(e.target.value)}
                    >
                      {brands.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>

                    <div className="field-between">
                      <label className="field-label">CONTENT TO AUDIT</label>
                      <span className="char-count">
                        {auditContent.length.toLocaleString()} / 20,000
                      </span>
                    </div>

                    <textarea
                      className="input content-textarea"
                      maxLength={20000}
                      value={auditContent}
                      onChange={e => setAuditContent(e.target.value)}
                      placeholder="Paste your marketing copy, campaign message, social post or product description here…"
                    />

                    <div className="audit-hint">
                      <CircleHelp size={15} />
                      Paste text directly, or upload a marketing image or PDF below.
                    </div>

                    <div className="upload-section">
                      <label className="field-label">
                        UPLOAD IMAGE OR PDF
                      </label>

                      <label className="upload-box" htmlFor="audit-file-input">
                        <div className="upload-icon">
                          <Upload size={22} />
                        </div>
                        <div className="upload-copy">
                          <b>Choose a file to upload</b>
                          <span>JPG, PNG, WEBP or PDF · Maximum 10 MB</span>
                        </div>
                        <span className="btn btn-outline upload-button">
                          Browse files
                        </span>
                      </label>

                      <input
                        id="audit-file-input"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleFileChange}
                        hidden
                      />

                      {auditFile && (
                        <div className="selected-file">
                          <div className="selected-file-icon">
                            {auditFile.type === 'application/pdf'
                              ? <FileText size={19} />
                              : <Image size={19} />}
                          </div>

                          <div className="selected-file-info">
                            <b>{auditFile.name}</b>
                            <span>
                              {(auditFile.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>

                          <button
                            type="button"
                            className="icon-btn"
                            title="Remove file"
                            onClick={() => {
                              setAuditFile(null);
                              const input = document.getElementById('audit-file-input');
                              if (input) input.value = '';
                            }}
                          >
                            <X size={17} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="audit-footer">
                      <div className="privacy-note">
                        <Shield size={15} />
                        Reviewed against approved brand guidelines
                      </div>

                      <button
                        className="btn btn-primary"
                        disabled={auditing || (!auditContent.trim() && !auditFile)}
                      >
                        {auditing
                          ? <><LoaderCircle className="spin" size={17} /> Analyzing…</>
                          : <><Sparkles size={17} /> Run brand audit</>}
                      </button>
                    </div>
                  </form>
                )}
              </section>

              <aside className="panel guidelines-panel">
                <div className="panel-head">
                  <div>
                    <h3>Audit context</h3>
                    <p>What the AI checks against</p>
                  </div>
                  <ShieldCheck size={19} className="green-icon" />
                </div>

                {currentBrand ? (
                  <>
                    <div className="context-brand">
                      <div className="brand-avatar">
                        {currentBrand.name?.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <b>{currentBrand.name}</b>
                        <small>Active brand profile</small>
                      </div>
                      <BadgeCheck size={17} className="green-icon" />
                    </div>

                    <ContextItem icon={BookOpen} label="Brand rules" value={`${currentBrand.rules?.length || 0} approved rules`} />
                    <ContextItem icon={FileCheck2} label="Approved facts" value={`${currentBrand.approvedFacts?.length || 0} verified facts`} />
                    <ContextItem icon={CheckCircle2} label="Approved terms" value={`${currentBrand.approvedTerms?.length || 0} preferred terms`} />
                    <ContextItem icon={AlertCircle} label="Prohibited terms" value={`${currentBrand.prohibitedTerms?.length || 0} restricted terms`} />

                    <div className="context-note">
                      <ShieldCheck size={16} />
                      <span>AI findings are recommendations. A human reviewer makes the final decision.</span>
                    </div>
                  </>
                ) : (
                  <p className="empty-text">Select a brand profile to see its guidelines.</p>
                )}
              </aside>

              {auditResult && (
                <section className="panel result-panel">
                  <ResultView audit={auditResult} onReview={review} reviewBusy={reviewBusy} />
                </section>
              )}
            </div>
          )}

          {page === 'brands' && (
            <>
              <div className="brand-summary">
                <div>
                  <div className="summary-number">{brands.length.toString().padStart(2, '0')}</div>
                  <div><b>Brand profiles</b><small>Connected to this workspace</small></div>
                </div>

                <div className="summary-divider" />

                <div>
                  <div className="summary-number">
                    {brands.reduce((n, b) => n + (b.rules?.length || 0), 0).toString().padStart(2, '0')}
                  </div>
                  <div><b>Brand rules</b><small>Standards enforced by AI</small></div>
                </div>

                <div className="summary-divider" />

                <div>
                  <div className="summary-number">
                    {brands.reduce((n, b) => n + (b.approvedFacts?.length || 0), 0).toString().padStart(2, '0')}
                  </div>
                  <div><b>Approved facts</b><small>Reference points for claims</small></div>
                </div>
              </div>

              <div className="brand-grid">
                {brands.map(b => (
                  <article className="panel brand-card" key={b._id}>
                    <div className="brand-card-top">
                      <div className="brand-avatar large">{b.name?.slice(0, 1).toUpperCase()}</div>
                      <span className="status-dot-label"><i /> Active</span>
                    </div>

                    <h3>{b.name}</h3>
                    <p>{b.description || 'No brand description added yet.'}</p>

                    <div className="tone-box">
                      <span>TONE OF VOICE</span>
                      <p>{b.toneOfVoice || 'Not specified'}</p>
                    </div>

                    <div className="brand-counts">
                      <span><BookOpen size={15} />{b.rules?.length || 0} rules</span>
                      <span><FileCheck2 size={15} />{b.approvedFacts?.length || 0} facts</span>
                      <span><AlertCircle size={15} />{b.prohibitedTerms?.length || 0} restricted</span>
                    </div>

                    <button
                      className="btn btn-outline full-btn"
                      onClick={() => {
                        setSelectedBrand(b._id);
                        setPage('audit');
                      }}
                    >
                      Audit with this brand <ArrowRight size={15} />
                    </button>
                  </article>
                ))}

                <button className="add-brand-card" onClick={() => setShowBrandForm(true)}>
                  <div className="add-brand-icon"><Plus size={23} /></div>
                  <b>Add another brand</b>
                  <span>Bring another brand's standards into BrandGuard.</span>
                </button>
              </div>

              {!brands.length && (
                <Empty
                  icon={BookOpen}
                  title="Your brand workspace is empty"
                  text="Create a brand profile with approved facts, preferred language and rules."
                  action="Create first brand"
                  onAction={() => setShowBrandForm(true)}
                />
              )}
            </>
          )}

          {page === 'history' && (
            <section className="panel history-panel">
              <div className="panel-head history-head">
                <div>
                  <h3>All audits</h3>
                  <p>{audits.length} content checks in your workspace</p>
                </div>

                <div className="search-wrap">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search audits…"
                  />
                </div>
              </div>

              <AuditList audits={filteredAudits} onOpen={setAuditResult} />

              {auditResult && (
                <div className="history-detail">
                  <button className="detail-close" onClick={() => setAuditResult(null)}>
                    <X size={16} /> Close details
                  </button>

                  <ResultView
                    audit={auditResult}
                    onReview={review}
                    reviewBusy={reviewBusy}
                  />
                </div>
              )}
            </section>
          )}

          <footer className="footer">
            <span>© 2026 BrandGuard AI · Built by Team ARJUNA</span>
            <span>
              <i className={cx('footer-dot', health)} />
              {health === 'online'
                ? 'All systems operational'
                : health === 'checking'
                  ? 'Connecting to API'
                  : 'Backend unavailable'}
            </span>
          </footer>
        </div>
      </main>

      {showBrandForm && (
        <div
          className="modal-backdrop"
          onMouseDown={e => e.target === e.currentTarget && setShowBrandForm(false)}
        >
          <form className="modal" onSubmit={createBrand}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">BRAND SETUP</div>
                <h2>Create a brand profile</h2>
                <p>Start with the standards your team needs to protect.</p>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowBrandForm(false)}
              >
                <X />
              </button>
            </div>

            <div className="modal-fields">
              <Field
                label="BRAND NAME *"
                value={brandForm.name}
                onChange={v => setBrandForm({ ...brandForm, name: v })}
                placeholder="e.g. NovaTech"
                required
              />

              <Field
                label="DESCRIPTION"
                value={brandForm.description}
                onChange={v => setBrandForm({ ...brandForm, description: v })}
                placeholder="What does this brand do?"
              />

              <Field
                label="TONE OF VOICE"
                value={brandForm.toneOfVoice}
                onChange={v => setBrandForm({ ...brandForm, toneOfVoice: v })}
                placeholder="e.g. Professional, warm and trustworthy"
              />

              <div className="form-field">
                <label className="field-label">A KEY BRAND RULE</label>
                <textarea
                  className="input mini-textarea"
                  value={brandForm.rule}
                  onChange={e => setBrandForm({ ...brandForm, rule: e.target.value })}
                  placeholder="e.g. Never make guaranteed performance claims without evidence."
                />
              </div>

              <div className="form-field">
                <label className="field-label">ONE APPROVED FACT</label>
                <textarea
                  className="input mini-textarea"
                  value={brandForm.approvedFact}
                  onChange={e => setBrandForm({ ...brandForm, approvedFact: e.target.value })}
                  placeholder="A verified statement the AI can use as reference."
                />
              </div>

              <Field
                label="APPROVED TERMS · COMMA SEPARATED"
                value={brandForm.approvedTerms}
                onChange={v => setBrandForm({ ...brandForm, approvedTerms: v })}
                placeholder="Brand name, preferred phrase"
              />

              <Field
                label="PROHIBITED TERMS · COMMA SEPARATED"
                value={brandForm.prohibitedTerms}
                onChange={v => setBrandForm({ ...brandForm, prohibitedTerms: v })}
                placeholder="guaranteed, risk-free"
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowBrandForm(false)}
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                disabled={savingBrand || !brandForm.name.trim()}
              >
                {savingBrand
                  ? <LoaderCircle className="spin" size={16} />
                  : <Plus size={16} />}
                Create profile
              </button>
            </div>
          </form>
        </div>
      )}

      {notice && (
        <div className={cx('toast', notice.type)}>
          {notice.type === 'success'
            ? <CheckCircle2 size={18} />
            : <AlertCircle size={18} />}
          {notice.message}
          <button onClick={() => setNotice(null)}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, note, tone }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className={`stat-icon ${tone}`}><Icon size={18} /></div>
        <span className="stat-period">ALL TIME</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

function Status({ value }) {
  const map = {
    non_compliant: ['danger', 'Non-compliant'],
    needs_review: ['warning', 'Needs review'],
    compliant: ['success', 'Compliant']
  };

  const [tone, label] = map[value] || ['neutral', value || 'Unknown'];

  return (
    <span className={`status-badge ${tone}`}>
      <i />{label}
    </span>
  );
}

function Severity({ value }) {
  return (
    <span className={`severity ${value || 'medium'}`}>
      {value || 'medium'}
    </span>
  );
}

function AuditList({ audits, onOpen }) {
  if (!audits.length) {
    return (
      <Empty
        icon={FileCheck2}
        title="No audits yet"
        text="Your completed content checks will appear here."
      />
    );
  }

  return (
    <div className="audit-list">
      {audits.map(a => (
        <button
          className="audit-row"
          key={a._id}
          onClick={() => onOpen(a)}
        >
          <div className="audit-file">
            {a.sourceType === 'image'
              ? <Image size={17} />
              : a.sourceType === 'pdf'
                ? <FileText size={17} />
                : <File size={17} />}
          </div>

          <div className="audit-info">
            <b>{a.brand?.name || 'Brand audit'}</b>
            <span>
              {a.fileName || a.submittedContent || ''}
              {(a.fileName || a.submittedContent || '').length > 88 ? '…' : ''}
            </span>
          </div>

          <div className="audit-meta">
            <Status value={a.overallStatus} />
            <small>{date(a.createdAt)}</small>
          </div>

          <ArrowUpRight size={16} className="row-arrow" />
        </button>
      ))}
    </div>
  );
}

function BrandRow({ brand, onClick }) {
  return (
    <button className="brand-row" onClick={onClick}>
      <div className="brand-avatar">
        {brand.name?.slice(0, 1).toUpperCase()}
      </div>

      <div>
        <b>{brand.name}</b>
        <small>
          {brand.rules?.length || 0} rules · {brand.approvedFacts?.length || 0} approved facts
        </small>
      </div>

      <ArrowRight size={16} />
    </button>
  );
}

function Empty({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={22} /></div>
      <b>{title}</b>
      <p>{text}</p>
      {action && (
        <button className="btn btn-outline" onClick={onAction}>
          {action} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function ContextItem({ icon: Icon, label, value }) {
  return (
    <div className="context-item">
      <div><Icon size={16} />{label}</div>
      <b>{value}</b>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }) {
  return (
    <div className="form-field">
      <label className="field-label">{label}</label>
      <input
        className="input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function ResultView({ audit, onReview, reviewBusy }) {
  if (!audit) return null;

  return (
    <div className="result-content">
      <div className="result-heading">
        <div>
          <div className="eyebrow">AI AUDIT REPORT</div>
          <h3>{audit.brand?.name || 'Brand'} review results</h3>
          <p>{date(audit.createdAt)}</p>
        </div>

        <Status value={audit.overallStatus} />
      </div>

      <div className="result-summary">
        <Sparkles size={17} />
        <p>{audit.summary}</p>
      </div>

      {audit.sourceType && audit.sourceType !== 'text' && (
        <div className="submitted-box">
          <span>UPLOADED FILE</span>
          <p>{audit.fileName || audit.submittedContent}</p>
          <small>
            {audit.mimeType} · {((audit.fileSize || 0) / (1024 * 1024)).toFixed(2)} MB
          </small>
        </div>
      )}

      <div className="submitted-box">
        <span>SUBMITTED CONTENT</span>
        <p>{audit.submittedContent}</p>
      </div>

      <div className="findings-head">
        <h4>Findings <span>{audit.findings?.length || 0}</span></h4>
        <span>AI recommendations · Human decision required</span>
      </div>

      {audit.findings?.length ? (
        audit.findings.map(f => (
          <article className="finding-card" key={f._id}>
            <div className="finding-top">
              <div>
                <Severity value={f.severity} />
                <span className="finding-category">{f.category}</span>
              </div>

              <span className={`review-state ${f.reviewStatus}`}>
                {f.reviewStatus === 'pending'
                  ? 'Awaiting review'
                  : f.reviewStatus === 'approved'
                    ? 'Approved'
                    : f.reviewStatus === 'rejected'
                      ? 'Dismissed'
                      : f.reviewStatus}
              </span>
            </div>

            <h4>{f.issue}</h4>
            <p className="finding-explanation">{f.explanation}</p>

            <div className="finding-quote">
              <span>ORIGINAL TEXT</span>
              <p>“{f.originalText}”</p>
            </div>

            <div className="guideline-ref">
              <span>GUIDELINE REFERENCE</span>
              <p>{f.guidelineReference}</p>
              <small>Evidence: {f.evidenceStatus}</small>
            </div>

            <div className="correction">
              <div>
                <CheckCircle2 size={16} />
                <span>SUGGESTED CORRECTION</span>
              </div>
              <p>{f.suggestedCorrection}</p>
            </div>

            {f.reviewStatus === 'pending' && (
              <div className="review-actions">
                <span>Does this finding need action?</span>

                <div>
                  <button
                    className="btn btn-outline reject-btn"
                    disabled={!!reviewBusy}
                    onClick={() => onReview(audit._id, f._id, 'rejected')}
                  >
                    {reviewBusy === `${f._id}-rejected`
                      ? <LoaderCircle className="spin" size={15} />
                      : <X size={15} />}
                    Dismiss
                  </button>

                  <button
                    className="btn btn-primary approve-btn"
                    disabled={!!reviewBusy}
                    onClick={() => onReview(audit._id, f._id, 'approved')}
                  >
                    {reviewBusy === `${f._id}-approved`
                      ? <LoaderCircle className="spin" size={15} />
                      : <Check size={15} />}
                    Approve finding
                  </button>
                </div>
              </div>
            )}
          </article>
        ))
      ) : (
        <div className="compliant-box">
          <ShieldCheck size={23} />
          <div>
            <b>No issues identified</b>
            <p>
              The submitted content passed the configured brand checks.
              Human review is still recommended before publication.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
