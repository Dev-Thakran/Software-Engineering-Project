# Hotel Booking System — Software Engineering Project

A simple full-stack hotel booking prototype built for a software engineering course. This repository includes an Express.js backend that serves a JSON-backed API and a static frontend (vanilla HTML/CSS/JS) for browsing rooms, making bookings, and managing check-ins.

## Features

- User authentication (login/register)
- Browse rooms and amenities
- Create and manage bookings
- Simple payment endpoint stub
- Manager and staff views for shifts and check-ins
- JSON files used as a lightweight datastore for development

## Tech Stack

- Node.js + Express
- Vanilla HTML, CSS and JavaScript for frontend
- JSON files in `/backend/data` as the development datastore
- Tests with `jest`

## Project Structure

- `backend/` — Express server, routes, controllers, repositories, and middleware
- `backend/data/` — sample JSON datasets (rooms, bookings, users, reviews, etc.)
- `frontend/` — static site (pages, JS, CSS, images)
- `tests/` — automated tests (Jest)

## Getting Started

Prerequisites: Node.js 18+ and npm.

1. Install dependencies

```bash
npm install
```

2. Start the server (development)

```bash
npm run dev
```

Or run the production server:

```bash
npm start
```

The backend serves the frontend statically. Open http://localhost:3000 in your browser after the server starts.

## API Endpoints (overview)

- `POST /auth/register` — register a new user
- `POST /auth/login` — login and receive a token
- `GET /rooms` — list rooms
- `GET /rooms/:id` — room details
- `POST /bookings` — create a booking
- `GET /bookings` — list bookings
- `POST /payment` — create payment (stub)
- `GET /shifts` — staff shifts
- `GET /checkins` — check-in records
- `GET /reviews` — public reviews (served from `backend/data/reviews.json`)

All API routes live under the corresponding paths and are implemented in `backend/routes/` and `backend/controllers/`.

## Data

This project uses JSON files in `backend/data/` as a simple datastore for development and testing. Files include `rooms.json`, `bookings.json`, `users.json`, and more. Treat these as example data – they are not intended for production use.

## Tests

Run the test suite with:

```bash
npm test
```

## Contributing

Contributions are welcome. Suggested workflow:

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Open a pull request

## License

This project uses the ISC license (see `package.json`).

## Contact

If you have questions, open an issue on the GitHub repository.
