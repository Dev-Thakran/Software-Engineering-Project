# La Extravaganza — Hotel Booking & Management System

A full-stack hotel booking platform built for a software engineering course, with three
distinct user roles — **customer**, **staff**, and **manager** — each backed by its own
authenticated views and API access. The project focuses on a clean layered backend
architecture, role-based access control, and a manager analytics dashboard driven by
live booking data.

## Highlights

- **Role-based system**: customers book rooms, staff manage check-ins and shifts,
  managers view revenue and occupancy analytics — each role is enforced server-side,
  not just hidden in the UI.
- **JWT authentication with hashed passwords**: `bcryptjs` hashes passwords on
  registration; login issues a signed JWT (8h expiry) carrying the user's id, name,
  and role, verified on every protected request via middleware.
- **Manager analytics dashboard**: four live Chart.js visualisations (top rooms bar
  chart, booking-mix doughnut, booking-trend line chart, revenue-by-floor bar chart),
  all driven by real booking/room/review data rather than static mockups.
- **Layered backend architecture**: routes → controllers → repositories, with
  Express middleware handling auth and role checks — separation of concerns rather
  than logic living directly in route handlers.
- **23 automated tests** (Jest) covering auth, booking calculations, payments, and an
  end-to-end integration flow.

## Screenshots

*(Add 2–3 screenshots or a short GIF here — the manager dashboard with charts and the
booking flow are the strongest ones to show.)*

## Tech Stack

- **Backend**: Node.js, Express 5, JWT (`jsonwebtoken`), `bcryptjs`
- **Frontend**: Vanilla HTML/CSS/JS, [Chart.js](https://www.chartjs.org/) for the
  manager analytics dashboard
- **Data**: JSON files as a lightweight datastore (see [Data](#data) below)
- **Testing**: Jest (23 tests across auth, booking, payment, and integration)
- **Tooling**: ESLint, Nodemon

## Architecture

```
backend/
  routes/         → defines API endpoints, applies auth/role middleware
  controllers/     → request handling and business logic
  repositories/    → reads/writes the JSON datastore
  middleware/      → JWT authentication and role-based access control
  data/            → JSON files acting as the dev datastore
frontend/
  pages/           → HTML pages (customer, staff, manager views)
  js/               → page logic, API calls, Chart.js dashboard rendering
  css/              → styling
tests/              → Jest unit and integration tests
```

Routes are kept thin — they wire up middleware and hand off to controllers, which
contain the actual logic and call into repositories for data access. This mirrors how
a real backend is structured before you swap the JSON datastore for a proper database.

## Getting Started

**Prerequisites**: Node.js 18+ and npm.

```bash
npm install
```

Copy `.env.example` to `.env` and set a `JWT_SECRET` (any long random string works for
local development — see [Security Notes](#security-notes) below):

```bash
cp .env.example .env
```

Run in development (auto-restarts on changes):

```bash
npm run dev
```

Or run as you would in production:

```bash
npm start
```

The backend serves the frontend statically — open `http://localhost:3000` after the
server starts.

## API Overview

| Method | Endpoint            | Access           | Description                       |
| ------ | -------------------- | ---------------- | ---------------------------------- |
| POST   | `/auth/register`     | Public           | Register a new customer account    |
| POST   | `/auth/login`         | Public           | Login, returns a JWT               |
| GET    | `/rooms`              | Public           | List rooms                         |
| GET    | `/rooms/:id`          | Public           | Room details                       |
| POST   | `/bookings`           | Authenticated    | Create a booking                   |
| GET    | `/bookings`           | Authenticated    | List bookings                      |
| POST   | `/payment`            | Authenticated    | Payment endpoint (stub)            |
| GET    | `/shifts`             | Staff/Manager    | Staff shift schedule               |
| GET    | `/checkins/today`     | Staff/Manager    | Today's check-ins                  |
| GET    | `/checkins/queue`     | Staff/Manager    | Guests awaiting check-in           |
| GET    | `/manager/stats`      | Manager only     | Revenue, occupancy, ratings summary|
| GET    | `/manager/top-rooms`  | Manager only     | Booking counts by room             |
| GET    | `/reviews`            | Public           | Public guest reviews               |

Role checks (`staff`, `manager`) are enforced by middleware on the server, not just
hidden in the frontend — a customer token cannot access manager routes even by calling
the API directly.

## Data

This project uses JSON files in `backend/data/` (rooms, bookings, users, shifts,
check-ins, reviews) as a lightweight datastore for development and testing, accessed
through a repository layer. This keeps the layer boundary in place, so swapping in a
real database (e.g. PostgreSQL or MongoDB) would mean changing the repositories only —
routes and controllers wouldn't need to change.

## Testing

```bash
npm test
```

23 Jest tests across four suites: authentication, booking logic (night calculation,
availability, total pricing), payment handling, and an end-to-end integration flow.

## Security Notes

This was built as a coursework project, so a couple of things are worth flagging
rather than hiding:

- The JWT secret is read from `process.env.JWT_SECRET` (see `.env.example`) rather
  than hardcoded, so it isn't committed to version control.
- Passwords are hashed with `bcryptjs` before storage — plaintext passwords are never
  written to disk.
- The JSON-file datastore is fine for development but isn't safe for concurrent
  writes at production scale — a real deployment would move this to a proper database.

## License

ISC (see `package.json`).
