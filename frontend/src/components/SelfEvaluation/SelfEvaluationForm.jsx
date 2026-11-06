import React, { useEffect, useMemo, useState } from 'react';
import apiService from '../../utils/api';
import './SelfEvaluationForm.css';

const SelfEvaluationForm = () => {
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState([]);
  const [assignedKpis, setAssignedKpis] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const currentUser = apiService.getCurrentUser();
  const myRole = (currentUser?.roles && currentUser.roles[0]) || 'Lecturer';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // fetch areas for my role and my assigned KPIs
        const [areasRes, myKpis] = await Promise.all([
          apiService.getAreas(myRole),
          apiService.getMyAssign().catch(() => apiService.getMyKpis())
        ]);
        setAreas(Array.isArray(areasRes) ? areasRes : []);
        setAssignedKpis(Array.isArray(myKpis) ? myKpis : []);
        // Auto-select first area
        const firstArea = (Array.isArray(areasRes) ? areasRes : []).find(Boolean);
        if (firstArea) {
          setSelectedAreaId(String(firstArea.id || firstArea.Id));
        }
      } catch (e) {
        console.error('Failed to load self-eval data', e);
        setError(e?.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [myRole]);

  const kpisInSelectedArea = useMemo(() => {
    const areaIdNum = Number(selectedAreaId);
    return assignedKpis.filter(k => (k.areaId ?? k.AreaId) === areaIdNum);
  }, [assignedKpis, selectedAreaId]);

  const handleScoreChange = (kpiId, value) => {
    const v = Number(value);
    if (Number.isNaN(v) || v < 0 || v > 5) return; // enforce 0..5
    setScores(prev => ({ ...prev, [kpiId]: v }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      const items = kpisInSelectedArea.map(k => ({
        kpiId: k.id ?? k.Id,
        score: Number(scores[k.id ?? k.Id] ?? 0)
      }));
      if (items.length === 0) {
        setError('No assigned KPIs found in the selected area.');
        setSubmitting(false);
        return;
      }
      const payload = {
        areaId: Number(selectedAreaId),
        comments: comments?.trim() || undefined,
        items
      };
      await apiService.createSelfAreaEvaluation(payload);
      setMessage('Self-evaluation submitted successfully.');
      // Clear scores but keep selected area
      setScores({});
      setComments('');
    } catch (e) {
      console.error('Submit self-eval failed', e);
      setError(e?.message || 'Failed to submit self-evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="self-eval-card"><div className="loading">Loading self-evaluation...</div></div>;
  }

  return (
    <div className="self-eval-card">
      <div className="self-eval-header">
        <h3>Self Evaluation</h3>
        <p>Evaluate your assigned KPIs. Scores are between 0 and 5 per KPI.</p>
      </div>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Area</label>
            <select
              className="form-input"
              value={selectedAreaId}
              onChange={e => setSelectedAreaId(e.target.value)}
            >
              {(areas || []).map(a => (
                <option key={a.id ?? a.Id} value={a.id ?? a.Id}>
                  {a.name ?? a.Name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="kpi-list">
          {kpisInSelectedArea.length === 0 ? (
            <div className="empty">No assigned KPIs in this area.</div>
          ) : (
            kpisInSelectedArea.map(kpi => (
              <div className="kpi-item" key={kpi.id ?? kpi.Id}>
                <div className="kpi-meta">
                  <div className="kpi-title">{kpi.title ?? kpi.Title}</div>
                  {kpi.description || kpi.Description ? (
                    <div className="kpi-desc">{kpi.description ?? kpi.Description}</div>
                  ) : null}
                </div>
                <div className="kpi-score">
                  <label>Score (0-5)</label>
                  <input
                    type="number"
                    className="form-input score-input"
                    min={0}
                    max={5}
                    step={1}
                    value={scores[kpi.id ?? kpi.Id] ?? ''}
                    onChange={e => handleScoreChange(kpi.id ?? kpi.Id, e.target.value)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="form-group">
          <label>Comments</label>
          <textarea
            className="form-input"
            placeholder="Optional comments"
            value={comments}
            onChange={e => setComments(e.target.value)}
          />
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Self-Evaluation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SelfEvaluationForm;
