import React, { useState, useEffect } from 'react';
import apiService from '../../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';
import './Reports.css';

const Reports = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [evaluationsData, setEvaluationsData] = useState([]);
  const [areaEvaluations, setAreaEvaluations] = useState([]);
  const [performanceData, setPerformanceData] = useState(null);
  const [lecturerAreaSummaries, setLecturerAreaSummaries] = useState([]); // HOD/Admin aggregated area evals
  const [deptAreaEvalResults, setDeptAreaEvalResults] = useState([]); // HOD: raw area evaluations for dept lecturers
  const [facultyAreaEvalResults, setFacultyAreaEvalResults] = useState([]); // Dean/Admin: raw area evaluations across faculty
  const [deptLecturers, setDeptLecturers] = useState([]); // HOD: lecturers list for self-evals tab
  const [hodsList, setHodsList] = useState([]); // Dean: HODs list for self-evals tab
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(getDefaultTab(user?.role));
  const [exporting, setExporting] = useState({ pdf: false, excel: false });
  // Subordinates list controls (Self-Evaluations tab)
  const [subSearch, setSubSearch] = useState('');
  const [subDeptFilter, setSubDeptFilter] = useState('');
  const [selfEvalView, setSelfEvalView] = useState({ user: null, items: [], supervisorItems: [], loading: false, error: '' });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: tomorrow.toISOString().split('T')[0]
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [isActiveSession, setIsActiveSession] = useState(true);
  const [recentActivity, setRecentActivity] = useState(false);

  function getDefaultTab(role) {
    if (role === 'hod') return 'reports';
    if (role === 'lecturer') return 'performance';
    if (role === 'dean') return 'reports';
    return 'reports';
  }

  useEffect(() => {
    fetchReportData();
    // eslint-disable-next-line
  }, [dateRange, user]);

  useEffect(() => {
    if (autoRefreshEnabled) {
      const refreshRate = recentActivity ? 15000 : isActiveSession ? 30000 : 60000;
      const interval = setInterval(() => fetchReportData(true), refreshRate);
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefreshEnabled, dateRange, user, recentActivity, isActiveSession]);

  useEffect(() => {
    let activityTimeout;
    const resetActivityTimer = () => {
      setRecentActivity(true);
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => setRecentActivity(false), 120000);
    };
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => document.addEventListener(event, resetActivityTimer, { passive: true }));
    return () => {
      clearTimeout(activityTimeout);
      activityEvents.forEach(event => document.removeEventListener(event, resetActivityTimer));
    };
  }, []);

  // Load self-evaluations lazily for a user (lecturer or HOD)
  const openSelfEvaluations = async (targetUser) => {
    if (!targetUser?.id) return;
    setSelfEvalView({ user: targetUser, items: [], supervisorItems: [], loading: true, error: '' });
    try {
      const [selfData, allAreaEvals] = await Promise.all([
        apiService.getSelfAreaEvaluationsByLecturer(targetUser.id),
        apiService.getAreaEvaluationsByLecturer(targetUser.id).catch(() => [])
      ]);
      const supervisorOnly = Array.isArray(allAreaEvals) ? allAreaEvals.filter(ev => !ev.isSelfEvaluation) : [];
      setSelfEvalView({
        user: targetUser,
        items: Array.isArray(selfData) ? selfData : [],
        supervisorItems: supervisorOnly,
        loading: false,
        error: ''
      });
    } catch (e) {
      setSelfEvalView({ user: targetUser, items: [], supervisorItems: [], loading: false, error: e?.message || 'Failed to load self-evaluations' });
    }
  };

  const closeSelfEvaluations = () => setSelfEvalView({ user: null, items: [], supervisorItems: [], loading: false, error: '' });

  // Export a side-by-side PDF (actually printable HTML) of self vs supervisor evaluations
  const exportSelfEvalsPDF = () => {
    if (!selfEvalView.user) return;
    const htmlEscape = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Index latest evaluation per area for self and supervisor
    const latestByArea = (list) => {
      const groups = (list || []).reduce((acc, ev) => {
        const key = ev.areaId || ev.area?.id || 'unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(ev);
        return acc;
      }, {});
      const out = new Map();
      Object.entries(groups).forEach(([key, arr]) => {
        const sorted = arr.slice().sort((a,b) => new Date(b.evaluatedAt||0) - new Date(a.evaluatedAt||0));
        out.set(String(key), sorted[0]);
      });
      return out;
    };

    const selfMap = latestByArea(selfEvalView.items);
    const supMap = latestByArea(selfEvalView.supervisorItems);
    const allAreaIds = Array.from(new Set([ ...selfMap.keys(), ...supMap.keys() ]));

    const rowsHTML = allAreaIds.map(key => {
      const se = selfMap.get(key);
      const sv = supMap.get(key);
      const areaName = se?.area?.name || sv?.area?.name || 'Area';
      const dateSelf = se?.evaluatedAt ? new Date(se.evaluatedAt).toLocaleString() : '';
      const dateSup = sv?.evaluatedAt ? new Date(sv.evaluatedAt).toLocaleString() : '';
      const totalSelf = typeof se?.totalScore === 'number' ? se.totalScore.toFixed(2) : (se?.totalScore ?? '');
      const totalSup = typeof sv?.totalScore === 'number' ? sv.totalScore.toFixed(2) : (sv?.totalScore ?? '');
      const itemsSelf = Array.isArray(se?.items) ? se.items : [];
      const itemsSup = Array.isArray(sv?.items) ? sv.items : [];
      const kpiIds = Array.from(new Set([ ...itemsSelf.map(i=>i.kpiId || i.kpi?.id), ...itemsSup.map(i=>i.kpiId || i.kpi?.id) ]));
      const kpiRows = kpiIds.map(kid => {
        const si = itemsSelf.find(i => (i.kpiId || i.kpi?.id) === kid);
        const vi = itemsSup.find(i => (i.kpiId || i.kpi?.id) === kid);
        const title = si?.kpi?.title || vi?.kpi?.title || `KPI ${kid}`;
        return `<tr>
          <td>${htmlEscape(title)}</td>
          <td style="text-align:center;">${htmlEscape(si?.score ?? '')}</td>
          <td style="text-align:center;">${htmlEscape(vi?.score ?? '')}</td>
        </tr>`;
      }).join('');
      return `
        <div class="area-block">
          <h3>${htmlEscape(areaName)}</h3>
          <table class="meta">
            <tr><th>Self Date</th><td>${htmlEscape(dateSelf)}</td><th>Supervisor Date</th><td>${htmlEscape(dateSup)}</td></tr>
            <tr><th>Self Total</th><td>${htmlEscape(totalSelf)}</td><th>Supervisor Total</th><td>${htmlEscape(totalSup)}</td></tr>
          </table>
          <table class="kpi">
            <tr><th>KPI</th><th>Self</th><th>Supervisor</th></tr>
            ${kpiRows || ''}
          </table>
          ${se?.comments ? `<div class="comments"><strong>Self comments:</strong> ${htmlEscape(se.comments)}</div>` : ''}
          ${sv?.comments ? `<div class="comments"><strong>Supervisor comments:</strong> ${htmlEscape(sv.comments)}</div>` : ''}
        </div>
      `;
    }).join('\n');

    // Overall totals
    const overallSelf = Array.from(selfMap.values()).reduce((s, ev) => s + (Number(ev?.totalScore) || 0), 0);
    const overallSup = Array.from(supMap.values()).reduce((s, ev) => s + (Number(ev?.totalScore) || 0), 0);

    const title = `Self-vs-Supervisor-${(selfEvalView.user.fullName||selfEvalView.user.name||selfEvalView.user.email||'user').replace(/\s+/g,'_')}`;
    const docHTML = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${htmlEscape(title)}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 28px; }
          h1 { color: #11486B; margin: 0 0 6px 0; font-size: 22px; }
          .subtitle { color: #475569; margin: 0 0 18px 0; font-size: 13px; }
          .summary { display:flex; gap:12px; padding:10px 12px; background:#f8fafc; border:2px solid #cbd5e1; border-radius:8px; margin-bottom: 14px; }
          .badge { background:#11486B; color:#fff; padding:6px 10px; border-radius:999px; font-weight:700; font-size:12px; }
          .area-block { border:2px solid #cbd5e1; border-radius:10px; padding:12px; margin-bottom:16px; background:#ffffff; }
          .area-block h3 { margin: 0 0 8px 0; color:#0f172a; font-size: 16px; }
          table { width:100%; border-collapse: collapse; margin-bottom: 10px; }
          th, td { border:2px solid #cbd5e1; padding:8px 10px; font-size: 12px; }
          th { background:#f1f5f9; text-align:left; }
          .meta th { width: 140px; }
          .comments { font-size:12px; color:#374151; margin-top: 6px; }
          @media print { a { display:none; } }
        </style>
      </head>
      <body>
        <h1>Self vs Supervisor Evaluation</h1>
        <div class="subtitle">${htmlEscape(selfEvalView.user.fullName || selfEvalView.user.name || selfEvalView.user.email || '')}</div>
        <div class="summary">
          <div class="badge">Overall Self Total: ${overallSelf.toFixed(2)}</div>
          <div class="badge" style="background:#0d3a56;">Overall Supervisor Total: ${overallSup.toFixed(2)}</div>
        </div>
        ${rowsHTML}
        <script>window.onload = function(){ try { window.print(); } catch(e){} };<\/script>
      </body>
      </html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(docHTML);
      win.document.close();
    } else {
      const blob = new Blob([docHTML], { type: 'text/html;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title}.html`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    return () => refreshInterval && clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    const handleEvaluationUpdate = () => { setRecentActivity(true); fetchReportData(true); };
    const handleStorageChange = (event) => {
      if (event.key === 'evaluationUpdated' || event.key === 'reportRefreshNeeded') {
        fetchReportData(true);
        localStorage.removeItem('evaluationUpdated');
        localStorage.removeItem('reportRefreshNeeded');
      }
    };
    const handleVisibilityChange = () => { if (!document.hidden && autoRefreshEnabled) fetchReportData(true); };

    window.addEventListener('evaluationUpdated', handleEvaluationUpdate);
    window.addEventListener('evaluationCreated', handleEvaluationUpdate);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('evaluationUpdated', handleEvaluationUpdate);
      window.removeEventListener('evaluationCreated', handleEvaluationUpdate);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoRefreshEnabled]);

  const fetchReportData = async (isAutoRefresh = false) => {
    if (!isAutoRefresh) setLoading(true); else setIsRefreshing(true);
    setError('');
    try {
      if (user?.role === 'hod') {
        const [deptReport, deptLecturers, myDept] = await Promise.all([
          apiService.get(`/reports/department?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
          apiService.getMyDepartmentLecturers(),
          user?.departmentId ? apiService.getDepartmentById(user.departmentId).catch(() => null) : Promise.resolve(null)
        ]);
        setReportData(deptReport);
        setEvaluationsData([]);
        // Fetch area evaluations per lecturer in department
        if (Array.isArray(deptLecturers)) {
          const deptName = myDept?.name || myDept?.Name || myDept?.departmentName || '';
          const annotatedLecturers = deptLecturers.map(l => ({ ...l, departmentName: l.departmentName || deptName }));
          setDeptLecturers(annotatedLecturers);
          const areaPromises = deptLecturers.map(l => (
            l?.id ? apiService.getAreaEvaluationsByLecturer(l.id).then(evs => ({ lecturer: l, evals: evs || [] })) : Promise.resolve(null)
          ));
          const results = (await Promise.all(areaPromises)).filter(Boolean);
          setLecturerAreaSummaries(summarizeLecturerAreas(results));
          // Replace lecturer objects inside results with annotated ones (by ID match)
          const annMap = new Map(annotatedLecturers.map(x => [x.id, x]));
          const annotatedResults = results.map(r => ({ lecturer: annMap.get(r.lecturer?.id) || r.lecturer, evals: (r.evals || []).filter(ev => !ev.isSelfEvaluation) }));
          setDeptAreaEvalResults(annotatedResults);
        } else {
          setLecturerAreaSummaries([]);
          setDeptAreaEvalResults([]);
          setDeptLecturers([]);
        }
      } else if (user?.role === 'lecturer') {
        const currentUser = apiService.getCurrentUser();
        const [perf, areaEvals] = await Promise.all([
          apiService.get(`/reports/my-performance?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
          currentUser?.id ? apiService.getAreaEvaluationsByLecturer(currentUser.id) : Promise.resolve([])
        ]);
        if (perf) setPerformanceData(perf);
        setAreaEvaluations(Array.isArray(areaEvals) ? areaEvals : []);
      } else if (user?.role === 'dean' || user?.role === 'admin') {
        // Prefer a comprehensive endpoint for dean/admin if available
        try {
          const compReport = await apiService.get(`/reports/comprehensive?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
          setReportData(compReport || null);
          // ALSO compute faculty area evaluations so charts can reflect latest area data
          const departments = await apiService.getDepartments();
          const deptList = Array.isArray(departments) ? departments : [];
          const lecturerFetches = deptList.map(d => (
            d?.id ? apiService.getDepartmentLecturers(d.id).catch(() => []) : Promise.resolve([])
          ));
          const lecturerGroups = await Promise.all(lecturerFetches);
          const idToDept = new Map(deptList.map(d => [d.id, d.name]));
          const allLecturers = lecturerGroups.flat().filter(Boolean).map(l => ({ ...l, departmentName: l.departmentName || idToDept.get(l.departmentId) || '' }));
          // Include HODs as evaluatees too (annotate department)
          let hods = [];
          try { hods = await apiService.getHODs(); } catch (_) { hods = []; }
          const hodsAnnotated = (hods || []).filter(Boolean).map(h => ({
            ...h,
            departmentName: h.departmentName || (h.departmentId ? idToDept.get(h.departmentId) : (h.department?.name || h.department || ''))
          }));
          setHodsList(hodsAnnotated);
          const everyone = [...allLecturers, ...hodsAnnotated];
          const seenDean = new Set();
          const uniqueLecturersDean = everyone.filter(l => {
            if (!l?.id || seenDean.has(l.id)) return false;
            seenDean.add(l.id);
            return true;
          });
          if (uniqueLecturersDean.length > 0) {
            const areaPromisesDean = uniqueLecturersDean.map(l => (
              l?.id ? apiService.getAreaEvaluationsByLecturer(l.id).then(evs => ({ lecturer: l, evals: evs || [] })) : Promise.resolve(null)
            ));
            const deanResults = (await Promise.all(areaPromisesDean)).filter(Boolean).map(x => ({ lecturer: x.lecturer, evals: (x.evals || []).filter(ev => !ev.isSelfEvaluation) }));
            setFacultyAreaEvalResults(deanResults);
          } else {
            setFacultyAreaEvalResults([]);
          }
          setLecturerAreaSummaries([]); // clear summaries for dean/admin context
        } catch (e) {
          // Fallback: Some environments forbid direct lecturer listing; aggregate via departments
          setReportData(null);
          const departments = await apiService.getDepartments();
          const deptList = Array.isArray(departments) ? departments : [];
          const lecturerFetches = deptList.map(d => (
            d?.id ? apiService.getDepartmentLecturers(d.id).catch(() => []) : Promise.resolve([])
          ));
          const lecturerGroups = await Promise.all(lecturerFetches);
          const idToDept = new Map(deptList.map(d => [d.id, d.name]));
          const allLecturers = lecturerGroups.flat().filter(Boolean).map(l => ({ ...l, departmentName: l.departmentName || idToDept.get(l.departmentId) || '' }));
          // Also include HODs in fallback (annotate department)
          let hods = [];
          try { hods = await apiService.getHODs(); } catch (_) { hods = []; }
          const hodsAnnotated = (hods || []).filter(Boolean).map(h => ({
            ...h,
            departmentName: h.departmentName || (h.departmentId ? idToDept.get(h.departmentId) : (h.department?.name || h.department || ''))
          }));
          const everyone = [...allLecturers, ...hodsAnnotated];
          // De-duplicate by ID
          const seen = new Set();
          const uniqueLecturers = everyone.filter(l => {
            if (!l?.id || seen.has(l.id)) return false;
            seen.add(l.id);
            return true;
          });
          if (uniqueLecturers.length > 0) {
            const areaPromises = uniqueLecturers.map(l => (
              l?.id ? apiService.getAreaEvaluationsByLecturer(l.id).then(evs => ({ lecturer: l, evals: evs || [] })) : Promise.resolve(null)
            ));
            const results = (await Promise.all(areaPromises)).filter(Boolean).map(x => ({ lecturer: x.lecturer, evals: (x.evals || []).filter(ev => !ev.isSelfEvaluation) }));
            setLecturerAreaSummaries(summarizeLecturerAreas(results));
            setFacultyAreaEvalResults(results);
          } else {
            setLecturerAreaSummaries([]);
            setFacultyAreaEvalResults([]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError(`Failed to fetch report data: ${err.message || 'Unknown error'}`);
    }
    setLastUpdated(new Date());
    setLoading(false);
    setIsRefreshing(false);
  };

  const handleManualRefresh = () => fetchReportData(false);
  const toggleAutoRefresh = () => setAutoRefreshEnabled(!autoRefreshEnabled);

  const handleExport = async (format) => {
    setExporting(prev => ({ ...prev, [format]: true }));
    
    try {
      // Client-side export for Excel using the same performance data as charts
      const buildExportDataset = (perf) => {
        if (!perf) return null;
        const rows = [];
        rows.push([`Report Period: ${dateRange.startDate} to ${dateRange.endDate}`]);
        rows.push([]);
        rows.push(['Overall']);
        rows.push(['Total Evaluations', 'Completed Evaluations', 'Average Score %']);
        rows.push([perf.overall.totalEvaluations, perf.overall.completedEvaluations, perf.overall.avgScore]);
        rows.push([]);
        if (Array.isArray(perf.byArea) && perf.byArea.length) {
          rows.push(['Performance by Area']);
          rows.push(['Area', 'Score %']);
          perf.byArea.forEach(a => rows.push([a.name, a.score]));
          rows.push([]);
        }
        if (Array.isArray(perf.byCategory) && perf.byCategory.length) {
          rows.push(['Performance by Category']);
          rows.push(['Category', 'Score %']);
          perf.byCategory.forEach(c => rows.push([c.name, c.score]));
          rows.push([]);
        }
        if (Array.isArray(perf.trends) && perf.trends.length) {
          rows.push(['Performance Trend']);
          rows.push(['Period', 'Score %']);
          perf.trends.forEach(t => rows.push([t.period, t.score]));
          rows.push([]);
        }
        if (Array.isArray(perf.topPerformers) && perf.topPerformers.length) {
          rows.push(['Top Performers']);
          rows.push(['Name', 'Department', 'Score %']);
          perf.topPerformers.forEach(p => rows.push([p.name, p.department || '', p.score]));
          rows.push([]);
        }
        return rows;
      };

      const toCSV = (rows) => rows.map(r => r.map(v => {
        const s = String(v ?? '');
        if (s.includes(',') || s.includes('\n') || s.includes('"')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(',')).join('\n');

      // Decide which performance to export based on role
      let filename = '';
      let perf = null;
      if (user.role === 'hod') {
        const deptPerf = buildDeptAreaPerformance(deptAreaEvalResults);
        perf = deptPerf || reportData?.performance || null;
        filename = `department-report-${dateRange.startDate}-to-${dateRange.endDate}`;
      } else if (user.role === 'lecturer') {
        const me = apiService.getCurrentUser();
        const areaPerf = buildDeptAreaPerformance(
          Array.isArray(areaEvaluations) && areaEvaluations.length > 0
            ? [{ lecturer: { id: me?.id, fullName: me?.fullName || me?.name || me?.email }, evals: areaEvaluations }]
            : []
        );
        perf = areaPerf;
        filename = `my-performance-${dateRange.startDate}-to-${dateRange.endDate}`;
      } else if (user.role === 'dean' || user.role === 'admin') {
        const facPerf = buildDeptAreaPerformance(facultyAreaEvalResults);
        perf = facPerf || reportData?.performance || null;
        filename = `comprehensive-report-${dateRange.startDate}-to-${dateRange.endDate}`;
      }

      if (format === 'excel') {
        const rows = buildExportDataset(perf) || [['No data']];
        const csv = toCSV(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.csv`;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      } else {
        // Client-side PDF export: build a printable HTML using the same performance data
        const rows = buildExportDataset(perf) || [];
        const htmlEscape = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const toHTMLTables = (rows) => {
          // Convert grouped rows to multiple tables split by empty lines
          const tables = [];
          let current = [];
          rows.forEach(r => {
            if (r.length === 0) {
              if (current.length) { tables.push(current); current = []; }
            } else {
              current.push(r);
            }
          });
          if (current.length) tables.push(current);
          return tables.map(tbl => `
            <table class="report-table">
              ${tbl.map((r, idx) => idx === 0 && r.length === 1
                ? `<tr><th colspan="${tbl[1] ? tbl[1].length : r.length}">${htmlEscape(r[0])}</th></tr>`
                : `<tr>${r.map((c, i) => (tbl[1] && idx === 1 ? `<th>${htmlEscape(c)}</th>` : `<td>${htmlEscape(c)}</td>`)).join('')}</tr>`
              ).join('')}
            </table>
          `).join('\n');
        };

        const docHTML = `<!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>${htmlEscape(filename)}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color: #111827; padding: 24px; }
            h1 { color: #11486B; margin-bottom: 4px; }
            .subtitle { color: #6b7280; margin-bottom: 20px; }
            .report-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
            .report-table th, .report-table td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12px; }
            .report-table th { background: #f8fafc; text-align: left; }
            @media print {
              a { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Performance Report</h1>
          <div class="subtitle">${htmlEscape(dateRange.startDate)} to ${htmlEscape(dateRange.endDate)}</div>
          ${toHTMLTables(rows)}
          <script>window.onload = function(){ try { window.print(); } catch(e){} };<\/script>
        </body>
        </html>`;

        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(docHTML);
          win.document.close();
        } else {
          // Popup blocked: download HTML file instead
          const blob = new Blob([docHTML], { type: 'text/html;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}.html`;
          document.body.appendChild(link);
          link.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(link);
        }
      }
      
    } catch (error) {
      console.error('Export error:', error);
      alert(`Failed to export ${format.toUpperCase()}: ${error.message}`);
    } finally {
      setExporting(prev => ({ ...prev, [format]: false }));
    }
  };

  const renderExportButtons = () => (
    <div className="export-controls">
      <button 
        className="btn btn-outline-primary btn-sm export-btn"
        onClick={() => handleExport('pdf')}
        disabled={exporting.pdf || loading}
        title="Export as PDF"
      >
        {exporting.pdf ? (
          <>
            <div className="spinner-sm"></div>
            Exporting PDF...
          </>
        ) : (
          <>Export PDF</>
        )}
      </button>
      
      <button 
        className="btn btn-outline-success btn-sm export-btn"
        onClick={() => handleExport('excel')}
        disabled={exporting.excel || loading}
        title="Export as Excel"
      >
        {exporting.excel ? (
          <>
            <div className="spinner-sm"></div>
            Exporting Excel...
          </>
        ) : (
          <>Export Excel</>
        )}
      </button>
    </div>
  );

  const renderPerformanceBlocks = (perf, labels = { area: 'Performance by Area', category: 'Performance by Category', trend: 'Performance Trend', totalLabel: 'Total Evaluations' }) => {
    if (!perf) return null;
    return (
      <div className="performance-report">
        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-content">
              <h3>{perf.overall.totalEvaluations}</h3>
              <p>{labels.totalLabel}</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-content">
              <h3>{perf.overall.completedEvaluations}</h3>
              <p>Completed</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-content">
              <h3>{perf.overall.avgScore}%</h3>
              <p>Average Score</p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="charts-grid">
          <div className="card chart-card">
            <div className="card-header">
              <h3 className="card-title">{labels.area}</h3>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={perf.byArea}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="score" fill="#11486B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <div className="card-header">
              <h3 className="card-title">{labels.category}</h3>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={perf.byCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, score }) => `${name}: ${score}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="score"
                  >
                    {perf.byCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#11486B', '#8884d8', '#82ca9d', '#ffc658'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card full-width">
            <div className="card-header">
              <h3 className="card-title">{labels.trend}</h3>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={perf.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#11486B" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Performers */}
        {Array.isArray(perf.topPerformers) && perf.topPerformers.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Top Performers</h3>
            </div>
            <div className="performers-list">
              {perf.topPerformers.map((performer, index) => (
                <div key={index} className="performer-item">
                  <div className="performer-rank">#{index + 1}</div>
                  <div className="performer-info">
                    <strong>{performer.name}</strong>
                    {performer.department && (
                      <span className="performer-department">{performer.department}</span>
                    )}
                  </div>
                  <div className="performer-score">{performer.score}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDateRangeSelector = () => (
    <div className="date-range-selector">
      <div className="date-input-group">
        <label>From:</label>
        <input
          type="date"
          value={dateRange.startDate}
          onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
          className="date-input"
        />
      </div>
      <div className="date-input-group">
        <label>To:</label>
        <input
          type="date"
          value={dateRange.endDate}
          onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
          className="date-input"
        />
      </div>
    </div>
  );

  const renderRealTimeControls = () => (
    <div className="real-time-controls">
      <div className="refresh-status">
        {isRefreshing && (
          <div className="refreshing-indicator">
            <div className="spinner"></div>
            <span>Updating...</span>
          </div>
        )}
        {lastUpdated && (
          <div className="last-updated">
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      <div className="controls-right">
        {renderExportButtons()}
      </div>
    </div>
  );

  const renderHODReports = () => (
    <>
      {user.role === 'hod' && (
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Department Reports
          </button>
          <button
            className={`tab-btn ${activeTab === 'self-evals' ? 'active' : ''}`}
            onClick={() => setActiveTab('self-evals')}
          >
            Self Evaluations
          </button>
        </div>
      )}

      {activeTab === 'reports' && (reportData?.performance || deptAreaEvalResults.length > 0) && (
        <div className="performance-report">
          {(() => {
            const areaPerf = buildDeptAreaPerformance(deptAreaEvalResults);
            const perf = areaPerf || reportData?.performance;
            if (!perf) return null;
            return (
              <>
                {/* Summary Cards */}
                <div className="summary-cards">
                  <div className="summary-card">
                    <div className="summary-icon">📊</div>
                    <div className="summary-content">
                      <h3>{perf.overall.totalEvaluations}</h3>
                      <p>Total Area Evaluations</p>
                    </div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-icon">✅</div>
                    <div className="summary-content">
                      <h3>{perf.overall.completedEvaluations}</h3>
                      <p>Completed</p>
                    </div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-icon">📈</div>
                    <div className="summary-content">
                      <h3>{perf.overall.avgScore}%</h3>
                      <p>Average Score</p>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="charts-grid">
                  <div className="card chart-card">
                    <div className="card-header">
                      <h3 className="card-title">Performance by Area</h3>
                    </div>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={perf.byArea}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="score" fill="#11486B" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card chart-card">
                    <div className="card-header">
                      <h3 className="card-title">Performance by Category</h3>
                    </div>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={perf.byCategory}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, score }) => `${name}: ${score}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="score"
                          >
                            {perf.byCategory.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#11486B', '#8884d8', '#82ca9d', '#ffc658'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card chart-card full-width">
                    <div className="card-header">
                      <h3 className="card-title">Performance Trend</h3>
                    </div>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={perf.trends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="score" stroke="#11486B" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Top Performers */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Top Performers</h3>
                  </div>
                  <div className="performers-list">
                    {perf.topPerformers.map((performer, index) => (
                      <div key={index} className="performer-item">
                        <div className="performer-rank">#{index + 1}</div>
                        <div className="performer-info">
                          <strong>{performer.name}</strong>
                          {performer.department && (
                            <span className="performer-department">{performer.department}</span>
                          )}
                        </div>
                        <div className="performer-score">{performer.score}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Evaluations tab removed for HOD as per requirements */}

      {activeTab === 'self-evals' && user.role === 'hod' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Subordinate Self-Evaluations</h3>
            <div className="self-evals-controls">
              <input
                type="text"
                className="control-input"
                placeholder="Search by name or email..."
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
              />
              <select className="control-select" value={subDeptFilter} onChange={(e)=> setSubDeptFilter(e.target.value)}>
                <option value="">All Departments</option>
                {Array.from(new Set((deptLecturers||[]).map(l => l.departmentName).filter(Boolean))).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="subordinates-table">
            <div className="table-row table-header">
              <div className="cell">Name</div>
              <div className="cell">Department</div>
              <div className="cell">Role</div>
              <div className="cell">Actions</div>
            </div>
            {(() => {
              const q = subSearch.trim().toLowerCase();
              const filtered = (deptLecturers || []).filter(l => {
                const matchesDept = subDeptFilter ? (l.departmentName === subDeptFilter) : true;
                const nm = (l.fullName || l.name || l.email || '').toLowerCase();
                const matchesSearch = q ? nm.includes(q) : true;
                return matchesDept && matchesSearch;
              });
              return filtered.length === 0 ? (
                <div className="empty">No subordinates found.</div>
              ) : (
                filtered.map(l => (
                  <div className="table-row" key={l.id}>
                    <div className="cell">{l.fullName || l.name || l.email}</div>
                    <div className="cell">{l.departmentName || ''}</div>
                    <div className="cell">Lecturer</div>
                    <div className="cell actions">
                      <button className="btn btn-sm btn-outline" onClick={() => openSelfEvaluations(l)}>View</button>
                    </div>
                  </div>
                ))
              );
            })()}
          </div>

          {/* Details Modal */}
          {selfEvalView.user && (
            <div className="modal-overlay" onClick={(e)=>{ if (e.target === e.currentTarget) closeSelfEvaluations(); }}>
              <div className="modal">
                <div className="modal-header">
                  <h3>Self-Evaluations • {selfEvalView.user.fullName || selfEvalView.user.name || selfEvalView.user.email}</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-outline-primary" onClick={exportSelfEvalsPDF}>Export PDF</button>
                    <button className="btn btn-sm" onClick={closeSelfEvaluations}>Close</button>
                  </div>
                </div>
                <div className="modal-body">
                  {selfEvalView.loading && <div className="loading">Loading...</div>}
                  {selfEvalView.error && <div className="error-message">{selfEvalView.error}</div>}
                  {!selfEvalView.loading && !selfEvalView.error && (
                    <>
                      <div className="self-evals-list">
                        {selfEvalView.items.length === 0 ? (
                          <div className="empty">No self-evaluations submitted.</div>
                        ) : (
                          selfEvalView.items.map((ev, idx) => (
                            <div className="self-eval-item" key={idx}>
                              <div className="self-eval-meta">
                                <div><strong>Area:</strong> {ev.area?.name || 'Area'}</div>
                                <div><strong>Date:</strong> {ev.evaluatedAt ? new Date(ev.evaluatedAt).toLocaleString() : ''}</div>
                                <div><strong>Total:</strong> {typeof ev.totalScore === 'number' ? ev.totalScore.toFixed(2) : ev.totalScore}</div>
                              </div>
                              <div className="self-eval-items">
                                {(ev.items || []).map((it, iidx) => (
                                  <div className="self-eval-kpi" key={iidx}>
                                    <div className="kpi-title">{it.kpi?.title || 'KPI'}:</div>
                                    <div className="kpi-score">{it.score}</div>
                                  </div>
                                ))}
                              </div>
                              {ev.comments && <div className="self-eval-comments"><em>{ev.comments}</em></div>}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="self-eval-summary">
                        <div className="summary-badge">Overall Self Total: {(selfEvalView.items || []).reduce((s,ev)=>s+(Number(ev.totalScore)||0),0).toFixed(2)}</div>
                        <div className="summary-badge" style={{ background: '#0d3a56' }}>Overall Supervisor Total: {(selfEvalView.supervisorItems || []).reduce((s,ev)=>s+(Number(ev.totalScore)||0),0).toFixed(2)}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  // Dean/Admin: Self-Evaluations of HODs
  const renderDeanSelfEvals = () => (
    <>
      {(user.role === 'dean' || user.role === 'admin') && (
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Performance
          </button>
          <button
            className={`tab-btn ${activeTab === 'self-evals' ? 'active' : ''}`}
            onClick={() => setActiveTab('self-evals')}
          >
            Self Evaluations
          </button>
        </div>
      )}

      {activeTab === 'self-evals' && (user.role === 'dean' || user.role === 'admin') && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">HOD Self-Evaluations</h3>
            <div className="self-evals-controls">
              <input
                type="text"
                className="control-input"
                placeholder="Search by name or email..."
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
              />
              <select className="control-select" value={subDeptFilter} onChange={(e)=> setSubDeptFilter(e.target.value)}>
                <option value="">All Departments</option>
                {Array.from(new Set((hodsList||[]).map(l => l.departmentName).filter(Boolean))).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="subordinates-table">
            <div className="table-row table-header">
              <div className="cell">Name</div>
              <div className="cell">Department</div>
              <div className="cell">Role</div>
              <div className="cell">Actions</div>
            </div>
            {(() => {
              const q = subSearch.trim().toLowerCase();
              const filtered = (hodsList || []).filter(l => {
                const matchesDept = subDeptFilter ? (l.departmentName === subDeptFilter) : true;
                const nm = (l.fullName || l.name || l.email || '').toLowerCase();
                const matchesSearch = q ? nm.includes(q) : true;
                return matchesDept && matchesSearch;
              });
              return filtered.length === 0 ? (
                <div className="empty">No HODs found.</div>
              ) : (
                filtered.map(h => (
                  <div className="table-row" key={h.id}>
                    <div className="cell">{h.fullName || h.name || h.email}</div>
                    <div className="cell">{h.departmentName || ''}</div>
                    <div className="cell">HOD</div>
                    <div className="cell actions">
                      <button className="btn btn-sm btn-outline" onClick={() => openSelfEvaluations(h)}>View</button>
                    </div>
                  </div>
                ))
              );
            })()}
          </div>

          {selfEvalView.user && (
            <div className="modal-overlay" onClick={(e)=>{ if (e.target === e.currentTarget) closeSelfEvaluations(); }}>
              <div className="modal">
                <div className="modal-header">
                  <h3>Self-Evaluations • {selfEvalView.user.fullName || selfEvalView.user.name || selfEvalView.user.email}</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-outline-primary" onClick={exportSelfEvalsPDF}>Export PDF</button>
                    <button className="btn btn-sm" onClick={closeSelfEvaluations}>Close</button>
                  </div>
                </div>
                <div className="modal-body">
                  {selfEvalView.loading && <div className="loading">Loading...</div>}
                  {selfEvalView.error && <div className="error-message">{selfEvalView.error}</div>}
                  {!selfEvalView.loading && !selfEvalView.error && (
                    <div className="self-evals-list">
                      {selfEvalView.items.length === 0 ? (
                        <div className="empty">No self-evaluations submitted.</div>
                      ) : (
                        selfEvalView.items.map((ev, idx) => (
                          <div className="self-eval-item" key={idx}>
                            <div className="self-eval-meta">
                              <div><strong>Area:</strong> {ev.area?.name || 'Area'}</div>
                              <div><strong>Date:</strong> {ev.evaluatedAt ? new Date(ev.evaluatedAt).toLocaleString() : ''}</div>
                              <div><strong>Total:</strong> {typeof ev.totalScore === 'number' ? ev.totalScore.toFixed(2) : ev.totalScore}</div>
                            </div>
                            <div className="self-eval-items">
                              {(ev.items || []).map((it, iidx) => (
                                <div className="self-eval-kpi" key={iidx}>
                                  <div className="kpi-title">{it.kpi?.title || 'KPI'}:</div>
                                  <div className="kpi-score">{it.score}</div>
                                </div>
                              ))}
                            </div>
                            {ev.comments && <div className="self-eval-comments"><em>{ev.comments}</em></div>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  // Summarize area evaluations per lecturer -> latest per area and overall
  const summarizeLecturerAreas = (results) => {
    return results.map(({ lecturer, evals }) => {
      const byArea = (evals || []).reduce((acc, ev) => {
        const key = ev.areaId || ev.area?.id || 'unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(ev);
        return acc;
      }, {});
      const areas = Object.values(byArea).map((list) => {
        const sorted = list.slice().sort((a, b) => new Date(b.evaluatedAt || 0) - new Date(a.evaluatedAt || 0));
        const ev = sorted[0];
        return {
          name: ev.area?.name || 'Area',
          weight: typeof ev.area?.weight === 'number' ? ev.area.weight : (ev.areaWeight ?? null),
          total: typeof ev.totalScore === 'number' ? ev.totalScore : 0
        };
      });
      const overall = areas.reduce((s, a) => s + (a.total || 0), 0);
      return {
        lecturerName: lecturer.fullName || lecturer.name || lecturer.email,
        lecturerId: lecturer.id,
        areas,
        overall
      };
    });
  };

  // Build department-level performance from raw area evaluation results
  const buildDeptAreaPerformance = (results) => {
    if (!Array.isArray(results) || results.length === 0) return null;

    const byAreaName = new Map();
    const byCategoryName = new Map(); // fallback to area name
    const trendMap = new Map(); // YYYY-MM -> {sumPct, count}
    const lecturerStats = new Map(); // lecturerId -> {name, deptName, sumPct, count}

    let totalEvaluations = 0;
    let globalSumPct = 0;
    let globalCount = 0;

    results.forEach(({ lecturer, evals }) => {
      if (!lecturer || !Array.isArray(evals)) return;
      const byArea = evals.reduce((acc, ev) => {
        const key = ev.areaId || ev.area?.id || 'unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(ev);
        return acc;
      }, {});

      Object.values(byArea).forEach(list => {
        const sorted = list.slice().sort((a, b) => new Date(b.evaluatedAt || b.date || 0) - new Date(a.evaluatedAt || a.date || 0));
        const ev = sorted[0];
        const items = Array.isArray(ev.items) ? ev.items : [];
        const areaName = ev.area?.name || 'Area';
        const when = new Date(ev.evaluatedAt || ev.date || Date.now());
        const ym = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`;

        const sum = items.reduce((s, it) => s + (Number(it.score) || 0), 0);
        const count = items.length || 1;
        const pct = Math.round((sum / (count * 5)) * 100);

        totalEvaluations += 1;
        globalSumPct += pct;
        globalCount += 1;

        const a = byAreaName.get(areaName) || { sumPct: 0, count: 0 };
        a.sumPct += pct; a.count += 1; byAreaName.set(areaName, a);

        const c = byCategoryName.get(areaName) || { sumPct: 0, count: 0 };
        c.sumPct += pct; c.count += 1; byCategoryName.set(areaName, c);

        const t = trendMap.get(ym) || { sumPct: 0, count: 0 };
        t.sumPct += pct; t.count += 1; trendMap.set(ym, t);

        const deptName = lecturer?.department?.name || lecturer?.departmentName || lecturer?.department || '';
        const ls = lecturerStats.get(lecturer.id) || { name: lecturer.fullName || lecturer.name || lecturer.email, deptName, sumPct: 0, count: 0 };
        // keep deptName if already present, else set
        if (!ls.deptName && deptName) ls.deptName = deptName;
        ls.sumPct += pct; ls.count += 1; lecturerStats.set(lecturer.id, ls);
      });
    });

    const avgScore = globalCount > 0 ? Math.round(globalSumPct / globalCount) : 0;
    const byArea = Array.from(byAreaName.entries()).map(([name, v]) => ({ name, score: Math.round(v.sumPct / v.count) }));
    const byCategory = Array.from(byCategoryName.entries()).map(([name, v]) => ({ name, score: Math.round(v.sumPct / v.count) }));
    const trends = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, v]) => ({ period, score: Math.round(v.sumPct / v.count) }));
    const topPerformers = Array.from(lecturerStats.values())
      .map(ls => ({ name: ls.name, score: Math.round(ls.sumPct / ls.count), department: ls.deptName || '' }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      overall: {
        totalEvaluations,
        completedEvaluations: totalEvaluations,
        avgScore,
      },
      byArea,
      byCategory,
      trends,
      topPerformers,
    };
  };

  // Render aggregated area evaluations for HOD/Admin
  const renderAggregatedAreaEvaluations = () => {
    return (
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header">
          <h3 className="card-title">Area Evaluations (Aggregated)</h3>
          <p className="card-subtitle">Per-lecturer latest area totals. Area total = sum(KPI scores 0–5) × Area weight</p>
        </div>
        <div className="card-body">
          {(!lecturerAreaSummaries || lecturerAreaSummaries.length === 0) ? (
            <p>No area evaluations recorded yet.</p>
          ) : (
            <div className="aggregated-table">
              <div className="table-row table-header">
                <div className="cell">Lecturer</div>
                <div className="cell">Areas (Total)</div>
                <div className="cell cell-sm">Overall</div>
              </div>
              {lecturerAreaSummaries.map((row, idx) => (
                <div key={idx} className="table-row">
                  <div className="cell"><strong>{row.lecturerName}</strong></div>
                  <div className="cell">
                    {row.areas.length === 0 ? (
                      <em>No area evaluations</em>
                    ) : (
                      <ul className="area-list">
                        {row.areas.map((a, aIdx) => (
                          <li key={aIdx}>{a.name} (w: {a.weight ?? '-'}) — {a.total}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="cell cell-sm"><strong>{row.overall}</strong></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLecturerPerformance = () => {
    if (!performanceData) {
      return (
        <div className="lecturer-performance">
          <div className="no-performance-data">
            <div className="no-data-icon">📊</div>
            <h3>No Performance Data Available</h3>
            <p>No evaluations have been completed for your account yet.</p>
            <small>Performance data will appear here once evaluations are submitted.</small>
          </div>
        </div>
      );
    }

    return (
      <div className="lecturer-performance">
        <div className="performance-overview">
          <div className="overview-card overall-score">
            <h3>Overall Performance</h3>
            <div className="score-circle">
              <span className="score-number">{performanceData.overallScore}%</span>
            </div>
          </div>

          <div className="category-scores">
            {Object.entries(performanceData.categoryScores).map(([category, score]) => (
              <div key={category} className="category-card">
                <h4>{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                <div className="score-bar">
                  <div className="score-fill" style={{ width: `${score}%` }}></div>
                  <span className="score-text">{score}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="evaluations-received">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Evaluations</h3>
            </div>
            <div className="evaluations-list">
              {performanceData.evaluations.map((evaluation, index) => (
                <div key={index} className="evaluation-item">
                  <div className="evaluation-header">
                    <div className="evaluator-info">
                      <h4>{evaluation.evaluator}</h4>
                      <span className="evaluation-date">{new Date(evaluation.date).toLocaleDateString()}</span>
                    </div>
                    <div className="evaluation-score">
                      <span className="score-badge">{evaluation.score}%</span>
                    </div>
                  </div>
                  <div className="evaluation-feedback">
                    <p>{evaluation.feedback}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {renderLecturerAreaEvaluations()}
      </div>
    );
  };

  // Render Area Evaluations section for lecturers
  const renderLecturerAreaEvaluations = () => {
    if (!Array.isArray(areaEvaluations) || areaEvaluations.length === 0) {
      return (
        <div className="card" style={{ marginTop: '16px' }}>
          <div className="card-header">
            <h3 className="card-title">Area Evaluations</h3>
          </div>
          <div className="card-body">
            <p>No area evaluations recorded yet.</p>
          </div>
        </div>
      );
    }

    // Group evaluations by AreaId (if multiple evaluations per area over time)
    const byArea = areaEvaluations.reduce((acc, ev) => {
      const key = ev.areaId || ev.area?.id || 'unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(ev);
      return acc;
    }, {});

    // Compute latest per area and aggregate totals
    const areaCards = Object.values(byArea).map((list) => {
      // Sort by date, pick latest
      const sorted = list.slice().sort((a, b) => new Date(b.evaluatedAt || b.date || 0) - new Date(a.evaluatedAt || a.date || 0));
      const ev = sorted[0];
      const areaName = ev.area?.name || 'Area';
      const areaWeight = typeof ev.area?.weight === 'number' ? ev.area.weight : (ev.areaWeight ?? null);
      const items = Array.isArray(ev.items) ? ev.items : [];
      const totalScore = typeof ev.totalScore === 'number' ? ev.totalScore : 0;
      return { areaName, areaWeight, items, totalScore };
    });

    const overallTotal = areaCards.reduce((sum, a) => sum + (a.totalScore || 0), 0);

    return (
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header">
          <h3 className="card-title">Area Evaluations</h3>
          <p className="card-subtitle">Each area total = sum(KPI scores 0–5) × Area weight</p>
        </div>
        <div className="card-body">
          <div className="area-evals-grid">
            {areaCards.map((a, idx) => (
              <div key={idx} className="area-eval-card">
                <div className="area-eval-header">
                  <h4>{a.areaName}</h4>
                  {a.areaWeight != null && (
                    <span className="area-weight">Weight: {a.areaWeight}</span>
                  )}
                </div>
                <div className="area-eval-table">
                  <div className="table-row table-header">
                    <div className="cell">KPI</div>
                    <div className="cell cell-sm">Score (0–5)</div>
                  </div>
                  {a.items.map((it, iIdx) => (
                    <div key={iIdx} className="table-row">
                      <div className="cell">{it.kpi?.title || `KPI #${it.kpiId}`}</div>
                      <div className="cell cell-sm">{it.score}</div>
                    </div>
                  ))}
                </div>
                <div className="area-total">Area Total: <strong>{a.totalScore}</strong></div>
              </div>
            ))}
          </div>
          <div className="overall-area-total">Overall Weighted Total: <strong>{overallTotal}</strong></div>
        </div>
      </div>
    );
  };

  return (
    <div className="reports-root">
      <div className="reports-header">
        <div className="header-top">
          <h1>
            {user.role === 'hod' && 'Department Reports & Evaluations'}
            {user.role === 'lecturer' && 'My Performance Dashboard'}
            {user.role === 'dean' && 'Faculty Reports'}
            {user.role === 'admin' && 'System Reports'}
          </h1>
        </div>
        <div className="header-controls">
          {renderDateRangeSelector()}
        </div>
      </div>

      {renderRealTimeControls()}

      <div className="reports-content">
        {loading ? (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Loading data...</span>
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <>
            {user.role === 'hod' && (
              <>
                {renderHODReports()}
                {renderAggregatedAreaEvaluations()}
                {/* My Self-Evaluations (HOD) */}
                <div className="card" style={{ marginTop: '16px' }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title">My Self-Evaluations</h3>
                    <div className="controls">
                      <button className="btn btn-outline-primary btn-sm" onClick={() => {
                        const me = apiService.getCurrentUser();
                        if (me?.id) openSelfEvaluations(me);
                      }}>View</button>
                      {selfEvalView.user && selfEvalView.user.id === apiService.getCurrentUser()?.id && (
                        <button className="btn btn-outline-primary btn-sm" onClick={exportSelfEvalsPDF} style={{ marginLeft: 8 }}>Export PDF</button>
                      )}
                    </div>
                  </div>
                  {selfEvalView.user && selfEvalView.user.id === apiService.getCurrentUser()?.id && (
                    <div className="card-body">
                      {selfEvalView.loading && <div className="loading">Loading...</div>}
                      {selfEvalView.error && <div className="error-message">{selfEvalView.error}</div>}
                      {!selfEvalView.loading && !selfEvalView.error && (
                        <>
                          <div className="self-evals-list">
                            {selfEvalView.items.length === 0 ? (
                              <div className="empty">No self-evaluations submitted.</div>
                            ) : (
                              selfEvalView.items.map((ev, idx) => (
                                <div className="self-eval-item" key={idx}>
                                  <div className="self-eval-meta">
                                    <div><strong>Area:</strong> {ev.area?.name || 'Area'}</div>
                                    <div><strong>Date:</strong> {ev.evaluatedAt ? new Date(ev.evaluatedAt).toLocaleString() : ''}</div>
                                    <div><strong>Total:</strong> {typeof ev.totalScore === 'number' ? ev.totalScore.toFixed(2) : ev.totalScore}</div>
                                  </div>
                                  <div className="self-eval-items">
                                    {(ev.items || []).map((it, iidx) => (
                                      <div className="self-eval-kpi" key={iidx}>
                                        <div className="kpi-title">{it.kpi?.title || 'KPI'}:</div>
                                        <div className="kpi-score">{it.score}</div>
                                      </div>
                                    ))}
                                  </div>
                                  {ev.comments && <div className="self-eval-comments"><em>{ev.comments}</em></div>}
                                </div>
                              ))
                            )}
                          </div>
                          <div className="self-eval-summary">
                            <div className="summary-badge">Overall Self Total: {(selfEvalView.items || []).reduce((s,ev)=>s+(Number(ev.totalScore)||0),0).toFixed(2)}</div>
                            <div className="summary-badge" style={{ background: '#0d3a56' }}>Overall Supervisor Total: {(selfEvalView.supervisorItems || []).reduce((s,ev)=>s+(Number(ev.totalScore)||0),0).toFixed(2)}</div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {user.role === 'lecturer' && (
              <>
                {/* Area-based performance for lecturer (charts + trends) */}
                {(() => {
                  const me = apiService.getCurrentUser();
                  const areaPerf = buildDeptAreaPerformance(
                    Array.isArray(areaEvaluations) && areaEvaluations.length > 0
                      ? [{ lecturer: { id: me?.id, fullName: me?.fullName || me?.name || me?.email, departmentName: me?.department?.name || me?.department || '' }, evals: areaEvaluations }]
                      : []
                  );
                  return renderPerformanceBlocks(areaPerf, {
                    area: 'My Performance by Area',
                    category: 'My Performance by Category',
                    trend: 'My Performance Trend',
                    totalLabel: 'Total Area Evaluations'
                  });
                })()}
                {/* Remove legacy overall performance categories section as requested */}
                {renderLecturerAreaEvaluations()}

                {/* Self Evaluations Viewer for Lecturer */}
                <div className="card" style={{ marginTop: '16px' }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title">My Self-Evaluations</h3>
                    <div className="controls">
                      <button className="btn btn-outline-primary btn-sm" onClick={() => {
                        const me = apiService.getCurrentUser();
                        if (me?.id) openSelfEvaluations(me);
                      }}>View</button>
                      {selfEvalView.user && (
                        <button className="btn btn-outline-primary btn-sm" onClick={exportSelfEvalsPDF} style={{ marginLeft: 8 }}>Export PDF</button>
                      )}
                    </div>
                  </div>
                  {selfEvalView.user && selfEvalView.user.id === apiService.getCurrentUser()?.id && (
                    <div className="card-body">
                      {selfEvalView.loading && <div className="loading">Loading...</div>}
                      {selfEvalView.error && <div className="error-message">{selfEvalView.error}</div>}
                      {!selfEvalView.loading && !selfEvalView.error && (
                        <div className="self-evals-list">
                          {selfEvalView.items.length === 0 ? (
                            <div className="empty">No self-evaluations submitted.</div>
                          ) : (
                            selfEvalView.items.map((ev, idx) => (
                              <div className="self-eval-item" key={idx}>
                                <div className="self-eval-meta">
                                  <div><strong>Area:</strong> {ev.area?.name || 'Area'}</div>
                                  <div><strong>Date:</strong> {ev.evaluatedAt ? new Date(ev.evaluatedAt).toLocaleString() : ''}</div>
                                  <div><strong>Total:</strong> {typeof ev.totalScore === 'number' ? ev.totalScore.toFixed(2) : ev.totalScore}</div>
                                </div>
                                <div className="self-eval-items">
                                  {(ev.items || []).map((it, iidx) => (
                                    <div className="self-eval-kpi" key={iidx}>
                                      <div className="kpi-title">{it.kpi?.title || 'KPI'}:</div>
                                      <div className="kpi-score">{it.score}</div>
                                    </div>
                                  ))}
                                </div>
                                {ev.comments && <div className="self-eval-comments"><em>{ev.comments}</em></div>}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {(user.role === 'dean' || user.role === 'admin') && (
              <>
                {renderPerformanceBlocks(
                  (Array.isArray(facultyAreaEvalResults) && facultyAreaEvalResults.length > 0)
                    ? buildDeptAreaPerformance(facultyAreaEvalResults)
                    : (reportData?.performance || null),
                  {
                    area: 'Faculty Performance by Area',
                    category: 'Faculty Performance by Category',
                    trend: 'Faculty Performance Trend',
                    totalLabel: 'Total Area Evaluations'
                  }
                )}
                {renderAggregatedAreaEvaluations()}
                {/* My Self-Evaluations (Dean/Admin) */}
                <div className="card" style={{ marginTop: '16px' }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title">My Self-Evaluations</h3>
                    <div className="controls">
                      <button className="btn btn-outline-primary btn-sm" onClick={() => {
                        const me = apiService.getCurrentUser();
                        if (me?.id) openSelfEvaluations(me);
                      }}>View</button>
                      {selfEvalView.user && selfEvalView.user.id === apiService.getCurrentUser()?.id && (
                        <button className="btn btn-outline-primary btn-sm" onClick={exportSelfEvalsPDF} style={{ marginLeft: 8 }}>Export PDF</button>
                      )}
                    </div>
                  </div>
                  {selfEvalView.user && selfEvalView.user.id === apiService.getCurrentUser()?.id && (
                    <div className="card-body">
                      {selfEvalView.loading && <div className="loading">Loading...</div>}
                      {selfEvalView.error && <div className="error-message">{selfEvalView.error}</div>}
                      {!selfEvalView.loading && !selfEvalView.error && (
                        <>
                          <div className="self-evals-list">
                            {selfEvalView.items.length === 0 ? (
                              <div className="empty">No self-evaluations submitted.</div>
                            ) : (
                              selfEvalView.items.map((ev, idx) => (
                                <div className="self-eval-item" key={idx}>
                                  <div className="self-eval-meta">
                                    <div><strong>Area:</strong> {ev.area?.name || 'Area'}</div>
                                    <div><strong>Date:</strong> {ev.evaluatedAt ? new Date(ev.evaluatedAt).toLocaleString() : ''}</div>
                                    <div><strong>Total:</strong> {typeof ev.totalScore === 'number' ? ev.totalScore.toFixed(2) : ev.totalScore}</div>
                                  </div>
                                  <div className="self-eval-items">
                                    {(ev.items || []).map((it, iidx) => (
                                      <div className="self-eval-kpi" key={iidx}>
                                        <div className="kpi-title">{it.kpi?.title || 'KPI'}:</div>
                                        <div className="kpi-score">{it.score}</div>
                                      </div>
                                    ))}
                                  </div>
                                  {ev.comments && <div className="self-eval-comments"><em>{ev.comments}</em></div>}
                                </div>
                              ))
                            )}
                          </div>
                          <div className="self-eval-summary">
                            <div className="summary-badge">Overall Self Total: {(selfEvalView.items || []).reduce((s,ev)=>s+(Number(ev.totalScore)||0),0).toFixed(2)}</div>
                            <div className="summary-badge" style={{ background: '#0d3a56' }}>Overall Supervisor Total: {(selfEvalView.supervisorItems || []).reduce((s,ev)=>s+(Number(ev.totalScore)||0),0).toFixed(2)}</div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;