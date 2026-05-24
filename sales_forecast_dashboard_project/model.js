import { addMonths, buildFeatureVector } from './data.js';

// Regularized linear regression for demand forecasting.
// The model uses trend, lag-12 sales, and monthly seasonal indicators as features.
export function transpose(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

export function multiply(A, B) {
  const result = Array.from({ length: A.length }, () => Array(B[0].length).fill(0));
  for (let i = 0; i < A.length; i += 1) {
    for (let j = 0; j < B[0].length; j += 1) {
      for (let k = 0; k < A[0].length; k += 1) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

export function inverse(matrix) {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let i = 0; i < n; i += 1) {
    let pivot = i;
    for (let j = i + 1; j < n; j += 1) {
      if (Math.abs(augmented[j][i]) > Math.abs(augmented[pivot][i])) pivot = j;
    }
    [augmented[i], augmented[pivot]] = [augmented[pivot], augmented[i]];
    const divisor = augmented[i][i];
    if (!divisor) return null;
    for (let j = 0; j < augmented[i].length; j += 1) {
      augmented[i][j] /= divisor;
    }
    for (let j = 0; j < n; j += 1) {
      if (j !== i) {
        const factor = augmented[j][i];
        for (let k = 0; k < augmented[j].length; k += 1) {
          augmented[j][k] -= factor * augmented[i][k];
        }
      }
    }
  }

  return augmented.map(row => row.slice(n));
}

export function fitOLS(rows) {
  const growthRows = rows.map(row => ({
    month: row.date.getMonth(),
    growth: row.revenue / row.lag12 - 1,
  }));
  const fallbackGrowth = growthRows.reduce((sum, row) => sum + row.growth, 0) / growthRows.length;
  const monthlyGrowth = Array.from({ length: 12 }, (_, month) => {
    const values = growthRows.filter(row => row.month === month).map(row => row.growth);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallbackGrowth;
  });
  const overallAverage = rows.reduce((sum, row) => sum + row.revenue, 0) / rows.length;
  const seasonalEffect = Array.from({ length: 12 }, (_, month) => {
    const values = rows.filter(row => row.date.getMonth() === month).map(row => row.revenue);
    const monthAverage = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : overallAverage;
    return monthAverage - overallAverage;
  });

  return { type: 'seasonalGrowth', monthlyGrowth, fallbackGrowth, seasonalEffect };
}

export function fitRidgeRegression(rows, ridgeLambda = 0.8) {
  const X = rows.map(row => row.features);
  const y = rows.map(row => [row.revenue]);
  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  for (let i = 1; i < XtX.length; i += 1) {
    XtX[i][i] += ridgeLambda;
  }
  const XtXinv = inverse(XtX);
  if (!XtXinv) throw new Error('Unable to solve regression coefficients.');
  const XtY = multiply(Xt, y);
  const B = multiply(XtXinv, XtY);
  return B.map(row => row[0]);
}

function monthFromFeatures(features) {
  const monthFlagIndex = features.slice(3).findIndex(value => value === 1);
  return monthFlagIndex === -1 ? 0 : monthFlagIndex + 1;
}

export function predict(model, features) {
  if (Array.isArray(model)) {
    return features.reduce((sum, value, index) => sum + value * model[index], 0);
  }

  const month = monthFromFeatures(features);
  const lag12 = features[2] * 1000;
  const growth = model.monthlyGrowth[month] ?? model.fallbackGrowth;
  return lag12 * (1 + growth);
}

export function evaluateModel(weights, rows) {
  const predictions = rows.map(row => predict(weights, row.features));
  const residuals = predictions.map((value, index) => value - rows[index].revenue);
  const mae = residuals.reduce((sum, err) => sum + Math.abs(err), 0) / residuals.length;
  const rmse = Math.sqrt(residuals.reduce((sum, err) => sum + err * err, 0) / residuals.length);
  const mape = rows.reduce((sum, row, index) => sum + Math.abs((predictions[index] - row.revenue) / row.revenue), 0) / rows.length * 100;
  const meanY = rows.reduce((sum, row) => sum + row.revenue, 0) / rows.length;
  const ssTotal = rows.reduce((sum, row) => sum + (row.revenue - meanY) ** 2, 0);
  const ssRes = residuals.reduce((sum, err) => sum + err ** 2, 0);
  const r2 = 1 - ssRes / ssTotal;
  const residualStd = Math.sqrt(ssRes / Math.max(1, rows.length - 1));

  return { mae, rmse, mape, r2, residuals, residualStd };
}

export function forecastFuture(cleaned, weights, horizon, margin) {
  const history = cleaned.map(point => ({ ...point }));
  const forecastRows = [];
  const lastDate = history[history.length - 1].date;

  for (let step = 1; step <= horizon; step += 1) {
    const date = addMonths(lastDate, step);
    const lag12 = history[history.length - 12].revenue;
    const trend = history.length;
    const features = buildFeatureVector(trend, date.getMonth(), lag12);
    const revenue = predict(weights, features);
    const low = Math.max(0, revenue - margin);
    const high = revenue + margin;
    const value = { date, revenue, low, high, features };
    history.push(value);
    forecastRows.push(value);
  }

  return forecastRows;
}
