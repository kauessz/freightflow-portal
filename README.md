# FreightFlow Portal

Frontend for the [FreightFlow API](https://github.com/kauecls/freightflow-api) — a maritime shipment management platform built as a professional portfolio project, targeting companies like Maersk Tech, project44, Shippeo, Flexport, and Descartes.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.1 | Framework (App Router, Turbopack) |
| React | 19.2.4 | UI |
| TypeScript | 5 (strict) | Language |
| Tailwind CSS | 4 | Styling |
| Axios | 1.14 | HTTP client with JWT interceptors |
| Leaflet + react-leaflet | 1.9.4 / 5 | Fleet Map |
| react-leaflet-cluster | 4.1.3 | Vessel marker clustering |
| lucide-react | 1.7 | Icons |

## Prerequisites

- **Node.js** 18 or later
- **freightflow-api** running locally at `http://localhost:8080` ([backend repo](https://github.com/kauecls/freightflow-api))

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/kauecls/freightflow-portal.git
cd freightflow-portal

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local and set:
# NEXT_PUBLIC_API_URL=http://localhost:8080

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build

```bash
npm run build
npm start
```

The build output will be in `.next/`. For deployment, the project is optimised for [Vercel](https://vercel.com).

## Features

- **JWT Authentication** with automatic token refresh on 401
- **Role-based access control** — ADMIN / OPERATOR / VIEWER / CLIENT with per-route guards
- **Shipment dashboard** with KPI cards, advanced filters (status, carrier, origin port, vessel, booking search), and paginated table
- **Fleet Map** — live vessel map powered by Leaflet with AIS position badges (Live / Cached / Estimated / Unavailable), risk-level colour markers, carrier and status filters, and a vessel detail drawer
- **Public tracking page** — shipment tracking by booking number, no authentication required
- **Port autocomplete** — 133 pre-loaded ports with UNLOCODE, country, timezone, and coordinates; auto-fills all fields on selection
- **CRUD modules** — Vessels (IMO, type, flag, capacity TEU), Voyages (Fleet Map readiness indicator), Ports (timezone + lat/lon), Customers, Users
- **Shipment detail** — full operational view with timeline, document status, customs status, and risk level
- **TypeScript strict mode** — no unsafe `any` casts, full type coverage across the codebase

## Project Structure

```
src/
├── app/
│   ├── dashboard/          # Protected pages (shipments, vessels, voyages, ports, customers, users)
│   │   └── shipments/[id]/ # Shipment detail with timeline
│   ├── map/                # Fleet Map (Leaflet, SSR-safe dynamic import)
│   ├── track/              # Public tracking page
│   └── login/              # Authentication
├── components/
│   ├── portal-header.tsx   # Top nav with role-based link visibility
│   ├── master-data-nav.tsx # Ports / Vessels / Voyages sub-nav
│   ├── ShipmentTimeline.tsx
│   └── ui/                 # button, card, input, select, badge
├── lib/
│   ├── api.ts              # Axios instance with Bearer token + refresh interceptors
│   ├── auth.ts             # Auth helpers (saveAuth, clearAuth, isAuthenticated)
│   ├── ports-data.ts       # 133 global ports with coordinates and timezones
│   └── utils.ts            # Date formatters, status colours, cn()
└── types/
    └── index.ts            # All TypeScript interfaces (Shipment, Voyage, Vessel, Port, ...)
```

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the FreightFlow API | `http://localhost:8080` |

## API

The portal consumes the [FreightFlow REST API](https://github.com/kauecls/freightflow-api) (Spring Boot 3.3 + Java 21). All requests are authenticated via JWT Bearer token with automatic silent refresh.

## License

MIT
