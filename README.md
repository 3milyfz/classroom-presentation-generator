# Classroom Presentation Randomizer MVP

Decoupled frontend and backend with user authentication and database persistence. Instructors log in to manage teams, randomize presenters, and run the dual-phase timer; all data persists across sessions and server restarts.

## Architecture

- **backend**: Express API with Prisma ORM, JWT auth, and database persistence (SQLite for local dev, PostgreSQL for production).
- **frontend**: React + Vite UI; login/register, then control panel and dashboard (all API calls require auth).

## Local Setup

### Backend (database and secrets)

1. `cd backend`
2. `npm install`
3. Copy env template and set secrets (do not commit `.env`):
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   - `DATABASE_URL="file:./dev.db"` (SQLite for local dev)
   - `JWT_SECRET=<a-long-random-string>` (e.g., generate with `openssl rand -hex 32`)
4. Create database and tables:
   ```bash
   npm run db:generate
   npm run db:push
   ```
5. Optional: seed a demo user. Set `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` in `.env`, then:
   ```bash
   npm run db:seed
   ```
6. Start the API: `npm start` — runs on **http://localhost:5001**

### Frontend

1. `cd frontend`
2. `npm install`
3. `npm start` — runs on **http://localhost:3000**

### Environment

- **Backend**: `.env` must contain `DATABASE_URL` and `JWT_SECRET` (see `.env.example` for variable names only). Port via `PORT` (default 5001).
- **Frontend**: Optional `VITE_API_BASE` if the API is on a different URL.
- **Secrets**: Never commit `.env`; `.env.example` lists variable names only (no credentials or example values in repo).

## Production Deployment

### Database Setup

For public deployment, use a managed PostgreSQL database (e.g., Railway, Supabase, Neon, Render):

1. Create a PostgreSQL database instance and get the connection string.
2. Set `DATABASE_URL` in your deployment environment (GitHub Secrets, cloud platform env vars, etc.):
   ```
   DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
   ```
3. **Switch Prisma to PostgreSQL**: Before deploying, change `backend/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"  // Changed from "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
   Then regenerate Prisma client:
   ```bash
   npm run db:generate
   ```
4. Run migrations to create tables:
   ```bash
   npm run db:push
   ```
   Or use migrations:
   ```bash
   npm run db:migrate
   ```

### Environment Variables

Set these in your deployment platform (GitHub Secrets, Vercel, Railway, etc.):

- `DATABASE_URL` — PostgreSQL connection string (required)
- `JWT_SECRET` — Long random string for signing JWTs (required)
- `PORT` — Server port (optional, defaults to 5001)

### Local Dev Still Works

- Local development uses SQLite (`DATABASE_URL="file:./dev.db"`).
- Production uses PostgreSQL via `DATABASE_URL` environment variable.
- Prisma automatically handles the differences; no code changes needed.

## Notes

- Instructors register or log in; teams and randomizer state are stored per user in the database and persist across sessions and server restarts.
- The randomizer avoids repeats until the round is reset; the timer has a 2-minute warning and auto Q&A phase.
- All state is persisted: refresh/restart doesn't lose data.
