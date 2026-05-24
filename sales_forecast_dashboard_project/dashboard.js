import { monthNames, rawHistory, cleanHistoricalData, createTrainingSet, formatMonthYear } from './data.js';
import { fitOLS, evaluateModel, forecastFuture } from './model.js';
import { renderForecastChart, renderResidualChart, renderDecompositionChart, renderCategoryDonut } from './charts.js';

// The dashboard module connects the forecasting engine with the HTML UI.
// It updates KPIs, error metrics, forecast tables, visual charts, and business commentary.
function formatRevenue(value) {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}M`;
  }
  return `$${value.toFixed(0)}K`;
}

function numberWithCommas(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function updateKPIs(metrics, forecastRows, cleaned) {
  const totalForecast = forecastRows.reduce((sum, row) => sum + row.revenue, 0);
  const priorAverage = cleaned.slice(-12).reduce((sum, row) => sum + row.revenue, 0) / 12;
  const delta = ((totalForecast / (priorAverage * 12) - 1) * 100).toFixed(1);
  const units = Math.round((totalForecast * 1000) / 70);

  document.getElementById('forecastRevenueValue').textContent = formatRevenue(totalForecast);
  document.getElementById('unitsForecastValue').textContent = numberWithCommas(units);
  document.getElementById('accuracyValue').textContent = `${(100 - metrics.mape).toFixed(1)}%`;
  document.getElementById('errorValue').textContent = `$${metrics.mae.toFixed(1)}K`;
  document.getElementById('revenueDelta').textContent = `${delta >= 0 ? '+' : '-'}${Math.abs(delta)}% vs. prior 12M`;
  document.getElementById('unitsDelta').textContent = `+${(units / 60000 * 100).toFixed(1)}% vs. target`;
  document.getElementById('accuracyDelta').textContent = `+${(100 - metrics.mape - 92.2).toFixed(1)}pp improvement`;
  document.getElementById('errorDelta').textContent = `-${Math.max(0, 40 - metrics.mae).toFixed(1)}% vs prior plan`;
}

export function updateErrorMetrics(metrics) {
  document.getElementById('mapeValue').textContent = `${metrics.mape.toFixed(1)}%`;
  document.getElementById('maeValue').textContent = `$${metrics.mae.toFixed(1)}K`;
  document.getElementById('rmseValue').textContent = `$${metrics.rmse.toFixed(1)}K`;
  document.getElementById('r2Value').textContent = metrics.r2.toFixed(3);
  document.getElementById('mapeBar').style.width = `${Math.min(metrics.mape * 3, 100)}%`;
  document.getElementById('maeBar').style.width = `${Math.min(metrics.mae * 2.5, 100)}%`;
  document.getElementById('rmseBar').style.width = `${Math.min(metrics.rmse * 1.8, 100)}%`;
  document.getElementById('r2Bar').style.width = `${Math.min(metrics.r2 * 100, 100)}%`;
}

export function populateForecastTable(forecastRows) {
  const tbody = document.getElementById('monthlyForecastBody');
  tbody.innerHTML = '';
  let priorValue = forecastRows[0].revenue;

  forecastRows.slice(0, 6).forEach(row => {
    const change = priorValue ? ((row.revenue - priorValue) / priorValue) * 100 : 0;
    const trendClass = change >= 0 ? 'up' : 'down';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatMonthYear(row.date)}</td>
      <td>${formatRevenue(Math.round(row.revenue))}</td>
      <td><span class="trend-chip ${trendClass}">${change >= 0 ? '+' : '-'}${Math.abs(change).toFixed(0)}%</span></td>
    `;
    tbody.appendChild(tr);
    priorValue = row.revenue;
  });
}

export function renderSeasonality(cleaned) {
  const counts = Array(12).fill(0);
  const sums = Array(12).fill(0);

  cleaned.forEach(row => {
    const month = row.date.getMonth();
    sums[month] += row.revenue;
    counts[month] += 1;
  });

  const averages = sums.map((sum, month) => (counts[month] ? sum / counts[month] : 0));
  const overall = averages.reduce((sum, value) => sum + value, 0) / 12;
  const indices = averages.map(value => (value ? value / overall : 1));

  document.querySelectorAll('.month-cell').forEach(cell => {
    const label = cell.querySelector('.m-label').textContent;
    const monthIndex = monthNames.indexOf(label);
    const value = indices[monthIndex] ?? 1;
    const cellValue = value.toFixed(2);
    cell.querySelector('.m-val').textContent = cellValue;
    cell.classList.remove('above', 'below', 'at');
    if (value > 1.05) cell.classList.add('above');
    else if (value < 0.95) cell.classList.add('below');
    else cell.classList.add('at');
  });
}

export function updateFooter(cleaned) {
  document.getElementById('footerText').textContent = `Data refreshed: ${formatMonthYear(cleaned[cleaned.length - 1].date)} | Model: seasonal YoY growth forecast | Training window: ${cleaned.length} months`;
  document.getElementById('modelType').textContent = 'Seasonal growth model';
  document.getElementById('modelWindow').textContent = 'Lag-12 + monthly seasonality';
}

export function setRange(btn) {
  document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

export function setupNavigation() {
  document.querySelectorAll('.nav-pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('.nav-pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
    });
  });

  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      const group = c.closest('.panel-actions');
      if (group) {
        group.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
      }
    });
  });
}

export function initializeDashboard() {
  const cleaned = cleanHistoricalData(rawHistory);
  const allRows = createTrainingSet(cleaned);
  const testRows = allRows.slice(-6);
  const trainRows = allRows.slice(0, -6);
  const weights = fitOLS(trainRows);
  const metrics = evaluateModel(weights, testRows);
  const forecastRows = forecastFuture(cleaned, weights, 12, metrics.residualStd * 1.65);

  updateKPIs(metrics, forecastRows, cleaned);
  updateErrorMetrics(metrics);
  populateForecastTable(forecastRows);
  renderForecastChart(cleaned, forecastRows);
  renderCategoryDonut();
  renderResidualChart(testRows, metrics);
  renderDecompositionChart(cleaned, allRows, weights);
  renderSeasonality(cleaned);
  updateFooter(cleaned);
}
