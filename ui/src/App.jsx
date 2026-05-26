import React, { useState, useCallback } from 'react';
import { createEventStream } from './api';

const STAGES = [
  { num: 1, name: 'Intent Extraction', key: 'intent' },
  { num: 2, name: 'System Design', key: 'design' },
  { num: 3, name: 'Schema Generator', key: 'schema' },
  { num: 4, name: 'Consistency Check', key: 'consistency' },
  { num: 5, name: 'Validation + Repair', key: 'validation' },
  { num: 6, name: 'Runtime Simulation', key: 'simulation' },
  { num: 7, name: 'Evaluation Logger', key: 'evaluation' },
];

const STAGE_NUM_MAP = {
  intent: 1, design: 2, schema: 3, consistency: 4,
  validation: 5, simulation: 6, evaluation: 7
};

const EXAMPLES = [
  "Build a CRM with login, contacts, dashboard, role-based access, premium plan with payments. Admins can see analytics.",
  "Create an e-commerce store with product listings, cart, checkout, Stripe payments, and order tracking.",
  "Build a project management tool like Trello with boards, cards, drag-drop, team members, and due dates.",
  "Create a job board where companies post jobs, candidates apply, and admins moderate listings.",
  "Build a SaaS analytics dashboard with user metrics, funnel charts, cohort analysis, and CSV export.",
  "Create an LMS with courses, lessons, quizzes, progress tracking, and certificate generation.",
  "Build a healthcare appointment booking system with doctor profiles, time slots, patient records, and reminders.",
  "Create a multi-tenant invoicing app with clients, invoices, recurring billing, and payment status.",
  "Build a social platform where users post, follow each other, like/comment, and get notifications.",
  "Create a real estate listing platform with property search, filters, agent profiles, and inquiry forms.",
];

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [stageStatus, setStageStatus] = useState({});
  const [stageData, setStageData] = useState({});
  const [stageLatency, setStageLatency] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('intent');
  const [expandedSections, setExpandedSections] = useState({});

  const handleGenerate = useCallback(() => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStageData({});
    setStageLatency({});
    setExpandedSections({});
    const initialStatus = {};
    STAGES.forEach(s => { initialStatus[s.num] = 'pending'; });
    setStageStatus(initialStatus);

    createEventStream(prompt.trim(), (type, data) => {
      switch (type) {
        case 'stage-start':
          setStageStatus(prev => ({ ...prev, [data.stage]: 'running' }));
          break;
        case 'stage-complete':
          setStageStatus(prev => ({ ...prev, [data.stage]: 'completed' }));
          if (data.latency) {
            setStageLatency(prev => ({ ...prev, [data.stage]: data.latency }));
          }
          if (data.data) {
            setStageData(prev => ({ ...prev, [data.stage]: data.data }));
          }
          if (data.report) {
            setStageData(prev => ({ ...prev, [data.stage]: data.report }));
          }
          if (data.metrics) {
            setStageData(prev => ({ ...prev, [data.stage]: data.metrics }));
          }
          if (data.errors) {
            setStageData(prev => ({ ...prev, [data.stage]: data.errors }));
          }
          if (data.validationResult) {
            setStageData(prev => ({ ...prev, [data.stage]: data.validationResult }));
          }
          break;
        case 'stage-warn':
          setStageStatus(prev => ({ ...prev, [data.stage]: 'warning' }));
          break;
        case 'stage-fail':
          setStageStatus(prev => ({ ...prev, [data.stage]: 'failed' }));
          break;
        case 'done':
          setLoading(false);
          setResult(data);
          break;
        case 'error':
          setLoading(false);
          setError(data.message);
          break;
      }
    });
  }, [prompt, loading]);

  const getStageIcon = (status) => {
    switch (status) {
      case 'pending': return <span className="stage-icon pending">○</span>;
      case 'running': return <span className="stage-icon running">◌</span>;
      case 'completed': return <span className="stage-icon completed">●</span>;
      case 'warning': return <span className="stage-icon warning">◉</span>;
      case 'failed': return <span className="stage-icon failed">✕</span>;
      default: return <span className="stage-icon pending">○</span>;
    }
  };

  const getStageLabel = (num) => {
    return STAGES.find(s => s.num === num)?.name || `Stage ${num}`;
  };

  const renderJson = (data) => {
    if (!data) return <span className="text-muted">No data</span>;
    try {
      return <pre className="json-block">{JSON.stringify(data, null, 2)}</pre>;
    } catch {
      return <span>{String(data)}</span>;
    }
  };

  const formatLatency = (ms) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const downloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-result-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="title">App Config Compiler</h1>
          <p className="subtitle">Natural Language → Full App Architecture</p>
        </div>
      </header>

      <main className="main">
        <div className="input-section">
          <div className="input-card">
            <label className="input-label" htmlFor="prompt">Describe your app:</label>
            <textarea
              id="prompt"
              className="prompt-input"
              placeholder="e.g., Build a CRM with login, contacts, dashboard, role-based access, premium plan with payments. Admins can see analytics."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={loading}
            />
            <div className="btn-row">
              <button
                className={`generate-btn ${loading ? 'loading' : ''}`}
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
              >
                {loading ? (
                  <><span className="spinner"></span> Generating...</>
                ) : (
                  <>Generate</>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="pipeline-section">
          <h2 className="section-title">Pipeline Progress</h2>
          <div className="stage-tracker">
            {STAGES.map((stage, idx) => {
              const status = stageStatus[stage.num] || 'pending';
              return (
                <React.Fragment key={stage.num}>
                  <div
                    className={`stage-badge ${status} ${activeTab === stage.key ? 'active' : ''}`}
                    onClick={() => setActiveTab(stage.key)}
                  >
                    {getStageIcon(status)}
                    <span className="stage-num">S{stage.num}</span>
                    <span className="stage-name">{stage.name}</span>
                    {stageLatency[stage.num] && (
                      <span className="stage-latency">{formatLatency(stageLatency[stage.num])}</span>
                    )}
                  </div>
                  {idx < STAGES.length - 1 && <div className={`stage-connector ${status === 'completed' ? 'completed' : ''}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div className="results-section">
          <div className="result-tabs">
            {STAGES.map(stage => (
              <button
                key={stage.key}
                className={`tab-btn ${activeTab === stage.key ? 'active' : ''}`}
                onClick={() => setActiveTab(stage.key)}
              >
                <span className={`tab-dot ${stageStatus[stage.num] || 'pending'}`}></span>
                S{stage.num}
              </button>
            ))}
            {result && (
              <button
                className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                onClick={() => setActiveTab('report')}
              >
                <span className="tab-dot completed"></span>
                Report
              </button>
            )}
          </div>

          <div className="tab-content">
            {activeTab === 'report' && result ? (
              <div className="report-panel">
                <div className="report-header">
                  <h3>Execution Report</h3>
                  <div className={`status-badge ${result.executionReport?.passed ? 'pass' : 'fail'}`}>
                    {result.executionReport?.passed ? 'PASS' : 'FAIL'}
                  </div>
                </div>

                {result.executionReport?.checks && (
                  <div className="checks-list">
                    {result.executionReport.checks.map((check, i) => (
                      <div key={i} className={`check-item ${check.status}`}>
                        <span className="check-status">{check.status === 'pass' ? '✓' : '✕'}</span>
                        <div className="check-detail">
                          <strong>{check.name}</strong>
                          <p>{check.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="metrics-grid">
                  <div className="metric-card">
                    <span className="metric-value">{formatLatency(result.metrics?.totalTime)}</span>
                    <span className="metric-label">Total Time</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-value">{result.executionReport?.passed_checks || 0}/{result.executionReport?.total_checks || 0}</span>
                    <span className="metric-label">Checks Passed</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-value">{result.metrics?.totalTokens?.input || 0}</span>
                    <span className="metric-label">Input Tokens</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-value">{result.metrics?.totalTokens?.output || 0}</span>
                    <span className="metric-label">Output Tokens</span>
                  </div>
                </div>

                {result.errors && result.errors.length > 0 && (
                  <div className="errors-section">
                    <h4>Errors</h4>
                    {result.errors.map((err, i) => (
                      <div key={i} className="error-item">
                        <strong>{err.stage}:</strong> {err.error}
                      </div>
                    ))}
                  </div>
                )}

                <div className="download-section">
                  <button className="download-btn" onClick={downloadJSON}>
                    Download Full JSON
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="stage-output-header">
                  <h3>{getStageLabel(STAGE_NUM_MAP[activeTab])}</h3>
                  <span className={`status-tag ${stageStatus[STAGE_NUM_MAP[activeTab]] || 'pending'}`}>
                    {(stageStatus[STAGE_NUM_MAP[activeTab]] || 'pending').toUpperCase()}
                  </span>
                </div>

                {renderJson(stageData[STAGE_NUM_MAP[activeTab]])}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
