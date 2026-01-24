# Classroom Presentation Randomizer MVP

Local-only MVP with a decoupled frontend and backend for the A2 rapid sprint.

## Architecture

- `backend`: Express API that serves the team roster and randomizer state.
- `frontend`: Vite-powered UI for randomizing teams, viewing the dashboard, and running the dual-phase timer.

## Local Setup

1. Backend
   - `cd /Users/emilyzhou/classroom-presentation-generator/backend`
   - `npm install`
   - `npm start`
   - API runs on `http://localhost:5001`
2. Frontend (in a new terminal tab)
   - `cd /Users/emilyzhou/classroom-presentation-generator/frontend`
   - `npm install`
   - `npm start`
   - App runs on `http://localhost:3000`

## Configuration

Set a custom API base URL in the frontend by exporting:

```
VITE_API_BASE=http://localhost:5001
```

## Notes

- The randomizer avoids repeats until the roster is reset.
- The timer warns when 2 minutes remain in the presentation phase, then auto-switches to Q&A.
