# SalesPulse Forecasting Dashboard

This project demonstrates a simple sales forecasting system using historical business data and a time-series-aware machine learning pipeline.

## What it does

- Cleans historical monthly revenue data
- Fills missing months using interpolation
- Builds time-based features:
  - trend index
  - lag-12 revenue
  - monthly seasonality indicators
- Trains a seasonal year-over-year growth forecast model
- Evaluates performance with MAE, RMSE, MAPE, and R2
- Displays forecast output with business-friendly charts and KPIs

## File structure

- `index.html`
  - Dashboard layout and visual presentation
  - Loads the JS entrypoint as a module

- `styles.css`
  - Dashboard styling for cards, charts, and layout

- `scripts.js`
  - Minimal entrypoint that initializes the dashboard

- `data.js`
  - Historical sales input
  - Date utilities and preprocessing functions
  - Feature engineering for trend and seasonality

- `model.js`
  - Machine learning model implementation
  - Seasonal growth forecasting
  - Forecast generation and validation

- `charts.js`
  - Chart.js rendering functions for forecast, residuals, and decomposition

- `dashboard.js`
  - UI binding and business KPI updates
  - Forecast table population
  - Dashboard initialization and interactive control setup

## Business value

This dashboard helps stakeholders:

- Understand how sales evolve over time
- See seasonality and trend behavior
- Plan inventory, staffing, and cash flow based on forecasted demand
- Compare forecast accuracy using industry-standard error metrics

## Running locally

### Web dashboard
Open `index.html` in a browser that supports ES modules, or run a local server from the project folder:

```bash
python -m http.server 8000
```

Then browse to `http://localhost:8000`.

### Jupyter notebook
Open `sales_forecast_notebook.ipynb` in Jupyter Notebook or VS Code. The notebook contains the full ML forecasting workflow:

- data cleaning and interpolation
- time-based feature creation
- regression model training and evaluation
- 12-month forecast visualization
- business interpretation of results

> The project is built to show a business-friendly forecast experience, not as an industrial production model. It illustrates key forecasting concepts: data preparation, feature creation, model evaluation, and stakeholder visualization.
