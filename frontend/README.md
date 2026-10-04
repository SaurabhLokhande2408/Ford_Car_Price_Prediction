# Ford price estimator frontend

React + Vite. No UI libraries. Models, ranges and options all come from the API.

## Run the frontend
    npm install
    npm run dev        # http://localhost:5173

API URL defaults to http://127.0.0.1:8000 (override with VITE_API_URL, see .env.example).

## Backend setup
1. Put `GROQ_API_KEY=...` in `Backend/.env`. Selecting a model loads its Groq-generated vehicle information immediately, and `/predict` also retrieves that information. Without the key, the information lookup fails.
2. From the project root: `python -m uvicorn Backend.app.api:app --reload --port 8000`

## Before publishing
Set your LinkedIn URL in `src/config.js`.
