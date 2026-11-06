// src/components/admin/CompletedEvaluations.jsx
import React, { useState, useEffect } from 'react';
import apiService from '../../utils/api';
import './CompletedEvaluations.css';

const CompletedEvaluations = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // fetch
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await apiService.getCompletedEvaluations();
        setEvaluations(res || []);
        setError('');
      } catch (err) {
        console.error('Failed to load evaluations', err);
        setError('Failed to load completed evaluations.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const downloadCsv = (row) => {
    const csv = [
      ['Lecturer', 'Evaluator', 'KPI', 'Score', 'Date'],
      [row.lecturerName, row.evaluatorName, row.kpiTitle, row.score, row.completedAt]
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `evaluation-${row.id}.csv`;
    link.click();
  };

  const downloadPdf = async (row) => {
    // You can either use backend to generate a real PDF,
    // or here create a simple blob with text.
    const content = `
      Evaluation Report
      =========================
      Lecturer: ${row.lecturerName}
      Evaluator: ${row.evaluatorName}
      KPI: ${row.kpiTitle}
      Score: ${row.score}
      Completed At: ${row.completedAt}
    `;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `evaluation-${row.id}.pdf`;
    link.click();
  };

  const exportAllCsv = () => {
    const csv = [
      ['Lecturer', 'Evaluator', 'KPI', 'Score', 'Date'],
      ...evaluations.map(r => [r.lecturerName, r.evaluatorName, r.kpiTitle, r.score, r.completedAt])
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-completed-evaluations.csv`;
    link.click();
  };

  if (loading) return <div className="completed-evals-container"><div className="loading">Loading...</div></div>;

  return (
    <div className="completed-evals-container">
      <div className="page-header">
        <div className="header-content">
          <h1>Completed Evaluations</h1>
          <p>View and export all completed KPI evaluations</p>
        </div>
        <div className="header-actions">
          {evaluations.length > 0 && (
            <button className="btn btn-primary" onClick={exportAllCsv}>Export All (CSV)</button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {evaluations.length === 0 ? (
        <div className="empty-state">No completed evaluations found.</div>
      ) : (
        <div className="table-wrapper">
          <table className="evals-table">
            <thead>
              <tr>
                <th>Lecturer</th>
                <th>Evaluator</th>
                <th>KPI</th>
                <th>Score</th>
                <th>Date</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map(ev => (
                <tr key={ev.id}>
                  <td>{ev.lecturerName}</td>
                  <td>{ev.evaluatorName}</td>
                  <td>{ev.kpiTitle}</td>
                  <td>{ev.score}</td>
                  <td>{new Date(ev.completedAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-outline" onClick={() => downloadCsv(ev)}>CSV</button>
                    <button className="btn btn-secondary" onClick={() => downloadPdf(ev)}>PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CompletedEvaluations;
