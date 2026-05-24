import { monthNames } from './data.js';
import { predict } from './model.js';

function setupCanvas(id) {
  const canvas = document.getElementById(id);
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { canvas, ctx, width: rect.width, height: rect.height };
}

function formatRevenue(value) {
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}M`;
  return `$${value.toFixed(0)}K`;
}

function drawGrid(ctx, plot, maxValue, minValue = 0) {
  ctx.strokeStyle = 'rgba(148,163,184,0.1)';
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Inter, sans-serif';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = plot.top + (plot.height / 5) * i;
    const value = maxValue - ((maxValue - minValue) / 5) * i;
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.left + plot.width, y);
    ctx.stroke();
    ctx.fillText(`${Math.round(value)}K`, 4, y + 4);
  }
}

function drawLine(ctx, points, color, dashed = false, fillTo = null) {
  const valid = points.filter(point => point.value !== null);
  if (!valid.length) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash(dashed ? [7, 5] : []);
  ctx.beginPath();
  valid.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  if (fillTo !== null) {
    ctx.lineTo(valid[valid.length - 1].x, fillTo);
    ctx.lineTo(valid[0].x, fillTo);
    ctx.closePath();
    ctx.fillStyle = color.replace('1)', '0.08)');
    ctx.fill();
  }

  valid.forEach(point => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.restore();
}

function buildPoints(values, plot, maxValue, minValue = 0) {
  const step = values.length > 1 ? plot.width / (values.length - 1) : plot.width;
  return values.map((value, index) => ({
    value,
    x: plot.left + step * index,
    y: value === null ? null : plot.top + plot.height - ((value - minValue) / (maxValue - minValue)) * plot.height,
  }));
}

export function renderForecastChart(cleaned, forecastRows) {
  const { ctx, width, height } = setupCanvas('forecastChart');
  const labels = [...cleaned, ...forecastRows].map(point => `${monthNames[point.date.getMonth()]} ${point.date.getFullYear()}`);
  const actualValues = [...cleaned.map(point => point.revenue), ...forecastRows.map(() => null)];
  const forecastValues = [...cleaned.slice(0, -1).map(() => null), cleaned[cleaned.length - 1].revenue, ...forecastRows.map(point => Math.round(point.revenue))];
  const highValues = [...cleaned.slice(0, -1).map(() => null), cleaned[cleaned.length - 1].revenue, ...forecastRows.map(point => Math.round(point.high))];
  const lowValues = [...cleaned.slice(0, -1).map(() => null), cleaned[cleaned.length - 1].revenue, ...forecastRows.map(point => Math.round(point.low))];
  const allValues = [...actualValues, ...forecastValues, ...highValues].filter(value => value !== null);
  const maxValue = Math.ceil(Math.max(...allValues) / 100) * 100;
  const plot = { left: 54, top: 18, width: width - 66, height: height - 74 };

  drawGrid(ctx, plot, maxValue);

  const highPoints = buildPoints(highValues, plot, maxValue);
  const lowPoints = buildPoints(lowValues, plot, maxValue);
  const band = highPoints.filter(point => point.value !== null);
  const bandLow = lowPoints.filter(point => point.value !== null).reverse();
  if (band.length && bandLow.length) {
    ctx.beginPath();
    band.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
    bandLow.forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(245,158,11,0.12)';
    ctx.fill();
  }

  drawLine(ctx, buildPoints(actualValues, plot, maxValue), 'rgba(79,140,255,1)', false);
  drawLine(ctx, buildPoints(forecastValues, plot, maxValue), 'rgba(245,158,11,1)', true);

  ctx.fillStyle = '#64748b';
  ctx.font = '10px Inter, sans-serif';
  labels.forEach((label, index) => {
    if (index % 2 !== 0) return;
    const x = plot.left + (plot.width / (labels.length - 1)) * index;
    ctx.save();
    ctx.translate(x, height - 40);
    ctx.rotate(-Math.PI / 4);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

export function renderResidualChart(testRows, metrics) {
  const { ctx, width, height } = setupCanvas('residualChart');
  const values = metrics.residuals.map(value => Math.round(value));
  const maxAbs = Math.max(20, ...values.map(value => Math.abs(value)));
  const plot = { left: 42, top: 12, width: width - 52, height: height - 44 };
  const zeroY = plot.top + plot.height / 2;
  const barWidth = plot.width / values.length * 0.56;

  ctx.strokeStyle = 'rgba(148,163,184,0.13)';
  ctx.fillStyle = '#64748b';
  ctx.font = '10px Inter, sans-serif';
  ctx.beginPath();
  ctx.moveTo(plot.left, zeroY);
  ctx.lineTo(plot.left + plot.width, zeroY);
  ctx.stroke();

  values.forEach((value, index) => {
    const x = plot.left + (plot.width / values.length) * index + barWidth * 0.4;
    const h = (Math.abs(value) / maxAbs) * (plot.height / 2 - 8);
    const y = value >= 0 ? zeroY - h : zeroY;
    ctx.fillStyle = value >= 0 ? 'rgba(79,140,255,0.85)' : 'rgba(251,113,133,0.85)';
    ctx.fillRect(x, y, barWidth, h);
    ctx.fillStyle = '#64748b';
    ctx.fillText(monthNames[testRows[index].date.getMonth()], x, height - 12);
  });
}

function getSeasonalEffect(model, month) {
  return model?.seasonalEffect?.[month] ?? 0;
}

export function renderDecompositionChart(cleaned, featureRows, model) {
  const { ctx, width, height } = setupCanvas('decompChart');
  const last12 = featureRows.slice(-12);
  const observed = last12.map(row => row.revenue);
  const trend = last12.map(row => Math.round(predict(model, row.features)));
  const adjusted = last12.map(row => Math.round(row.revenue - getSeasonalEffect(model, row.date.getMonth())));
  const allValues = [...observed, ...trend, ...adjusted];
  const maxValue = Math.ceil(Math.max(...allValues) / 100) * 100;
  const minValue = Math.floor(Math.min(...allValues) / 100) * 100;
  const plot = { left: 54, top: 18, width: width - 66, height: height - 52 };

  drawGrid(ctx, plot, maxValue, minValue);
  drawLine(ctx, buildPoints(observed, plot, maxValue, minValue), 'rgba(79,140,255,1)');
  drawLine(ctx, buildPoints(trend, plot, maxValue, minValue), 'rgba(245,158,11,1)', true);
  drawLine(ctx, buildPoints(adjusted, plot, maxValue, minValue), 'rgba(34,197,94,1)', true);

  ctx.fillStyle = '#64748b';
  ctx.font = '10px Inter, sans-serif';
  last12.forEach((row, index) => {
    const x = plot.left + (plot.width / (last12.length - 1)) * index;
    ctx.fillText(monthNames[row.date.getMonth()], x - 9, height - 12);
  });
}

export function renderCategoryDonut() {
  const { ctx, width, height } = setupCanvas('donutChart');
  const values = [42, 24, 19, 15];
  const colors = ['#4f8cff', '#9b7cff', '#22c55e', '#f59e0b'];
  const total = values.reduce((sum, value) => sum + value, 0);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.36;
  let start = -Math.PI / 2;

  values.forEach((value, index) => {
    const angle = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.arc(cx, cy, radius * 0.62, start + angle, start, true);
    ctx.closePath();
    ctx.fillStyle = colors[index];
    ctx.fill();
    start += angle;
  });

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 22px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('42%', cx, cy - 2);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 10px Inter, sans-serif';
  ctx.fillText('TOP CATEGORY', cx, cy + 16);
  ctx.textAlign = 'left';
}
