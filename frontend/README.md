# RiskGuard — Frontend

React dashboard (Vite) for the Razorpay AI Risk Manager hackathon. A merchant-facing
fraud/chargeback risk dashboard that visualizes the ML model's flagged transactions,
their SHAP explainability, and the LLM-drafted chargeback evidence packets.

## Setup

```bash
cd frontend
npm install
```

## Run

```bash
npm run dev
```

Vite will start a dev server (usually on http://localhost:5173) with hot reload.

## Prerequisite

The backend must be running on **http://localhost:8001** first:

```bash
cd backend
npm run dev
```

If the backend port ever changes, update `API_BASE_URL` in `frontend/src/config.js`.

## Pages

- `/` — Dashboard: stat cards, recommended-actions chart, honest true-positive vs
  false-positive metrics
- `/transactions` — Flagged transaction list (filterable, sortable)
- `/transactions/:orderId` — Transaction detail with SHAP explainability, false-positive
  callout, and full AI evidence packet

## Stack

- Vite + React (functional components, hooks)
- react-router-dom for routing
- recharts for charts
- axios for API calls

This is a read-only dashboard — it never mutates data and never calls the Groq API.
