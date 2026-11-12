# Connect Backoffice – Backend API

Independent Node.js + Express + TypeScript + Mongoose REST API for the Connect App Centralized Backoffice Management System.

## Environment Variables
Copy `.env.example` to `.env`:
- `PORT`: `8007`
- `MONGODB_URI`: Connection URI to MongoDB `connect_db`
- `JWT_SECRET` & `REFRESH_TOKEN_SECRET`

## Scripts
- `npm run dev` — Start development server with `ts-node-dev`
- `npm run build` — Compile TypeScript to `dist/`
- `npm start` — Run production build `dist/server.js`
- `npm run seed` — Seed initial organizational hierarchy and sample operational records

