// ============================================================
// charts.js — Chart.js Wrappers for Dashboards
// ============================================================

let chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function renderRadar(canvasId, teacherId) {
  destroyChart(canvasId);
  const stats = getTeacherStats(teacherId);
  if (!stats || !Object.keys(stats.sectionAverages).length) return;
  const labels = Object.keys(stats.sectionAverages);
  const data = Object.values(stats.sectionAverages);
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Score',
        data,
        backgroundColor: 'rgba(124, 58, 237, 0.25)',
        borderColor: '#7c3aed',
        pointBackgroundColor: '#a78bfa',
        pointBorderColor: '#fff',
        borderWidth: 2,
      }]
    },
    options: {
      scales: { r: { min: 0, max: 5, ticks: { stepSize: 1, color: '#94a3b8', backdropColor: 'transparent' }, grid: { color: 'rgba(148,163,184,0.15)' }, pointLabels: { color: '#e2e8f0', font: { size: 12 } } } },
      plugins: { legend: { labels: { color: '#e2e8f0' } } },
      responsive: true, maintainAspectRatio: true
    }
  });
}

function renderBar(canvasId, teacherId) {
  destroyChart(canvasId);
  const stats = getTeacherStats(teacherId);
  if (!stats) return;
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['⭐ 1 - Poor', '⭐ 2 - Fair', '⭐ 3 - Good', '⭐ 4 - Very Good', '⭐ 5 - Excellent'],
      datasets: [{
        label: 'Number of Ratings',
        data: stats.distribution,
        backgroundColor: ['#ef4444','#f97316','#eab308','#22c55e','#7c3aed'],
        borderRadius: 6,
      }]
    },
    options: {
      plugins: { legend: { labels: { color: '#e2e8f0' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
        y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.1)' }, beginAtZero: true }
      },
      responsive: true, maintainAspectRatio: true
    }
  });
}

function renderTrend(canvasId, teacherId) {
  destroyChart(canvasId);
  const stats = getTeacherStats(teacherId);
  if (!stats || !stats.trendData.length) return;
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: stats.trendData.map(d => d.label),
      datasets: [{
        label: 'Avg Score Trend',
        data: stats.trendData.map(d => d.avg),
        borderColor: '#a78bfa',
        backgroundColor: 'rgba(167,139,250,0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#7c3aed',
      }]
    },
    options: {
      plugins: { legend: { labels: { color: '#e2e8f0' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
        y: { min: 0, max: 5, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.1)' } }
      },
      responsive: true, maintainAspectRatio: true
    }
  });
}

function renderInstitutionBar(canvasId) {
  destroyChart(canvasId);
  const stats = getInstitutionStats();
  if (!stats.length) return;
  const ctx = document.getElementById(canvasId).getContext('2d');
  const colors = ['#7c3aed','#a78bfa','#6d28d9','#8b5cf6','#c4b5fd','#4c1d95'];
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.map(s => s.teacher.name),
      datasets: [{
        label: 'Overall Average Score',
        data: stats.map(s => s.stats.overallAvg),
        backgroundColor: stats.map((_, i) => colors[i % colors.length]),
        borderRadius: 8,
      }]
    },
    options: {
      plugins: { legend: { labels: { color: '#e2e8f0' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
        y: { min: 0, max: 5, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.1)' } }
      },
      responsive: true, maintainAspectRatio: true
    }
  });
}
