# Tasty Table — Architecture

## Overview

A restaurant ordering and management platform with three experiences:
1. **Public Menu** (`/`) — customers browse, add to cart, checkout, track order status
2. **Admin Dashboard** (`/admin`) — authenticated menu CRUD, order history, staff management
3. **Kitchen Screen** (`/kitchen`) — real-time order board with status progression

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript (Vite) |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL 16 (via Prisma ORM) |
| Auth | JWT (passport-jwt) + bcrypt password hashing |
| Real-time | Socket.io |
| Image Storage | MinIO (S3-compatible) |
| Styling | Tailwind CSS 3 + shadcn/ui |
| State | Zustand (cart, auth) + React Context (language) |
| Deployment | Docker Compose |

## Project Structure

```
tasty-table-studio/
├── apps/
│   ├── api/                        # NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Database schema
│   │   │   └── seed.ts             # Seed script
│   │   ├── src/
│   │   │   ├── auth/               # JWT login, strategy, guards
│   │   │   ├── menu/               # Categories + MenuItems CRUD
│   │   │   ├── orders/             # Orders CRUD + status management
│   │   │   ├── users/              # Staff management
│   │   │   ├── dashboard/          # Stats aggregation
│   │   │   ├── storage/            # S3/MinIO image upload
│   │   │   ├── websocket/          # Socket.io gateway
│   │   │   ├── prisma/             # PrismaService
│   │   │   ├── common/             # Guards, decorators
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── docker-compose.yml
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/                        # React frontend
│       └── src/
│           ├── features/           # Feature modules
│           │   ├── menu/           # Public menu browse
│           │   ├── cart/           # Cart drawer
│           │   ├── checkout/       # Order placement
│           │   ├── orders/         # Customer order status lookup
│           │   ├── admin/          # Admin dashboard (layout + 4 views)
│           │   ├── kitchen/        # Kitchen order screen
│           │   └── auth/           # Login page
│           ├── components/ui/      # shadcn/ui primitives (50+)
│           ├── stores/             # Zustand stores
│           ├── i18n/               # Arabic/English translations
│           ├── lib/
│           │   ├── api.ts          # API client (fetch + JWT)
│           │   ├── types.ts        # TypeScript interfaces
│           │   ├── constants.ts    # Status labels, colors
│           │   └── utils.ts        # cn(), formatPrice(), timeAgo()
│           └── App.tsx
├── docker-compose.yml              # Full stack deployment
└── ARCHITECTURE.md
```

## Database Schema

```
User            Role (admin | kitchen_staff)
Category        nameAr, nameEn, sortOrder
MenuItem        categoryId, nameAr, nameEn, price, image, available
MenuItemVariant menuItemId, nameAr, nameEn, priceAdjust
Order           orderNumber (auto-increment), customerName, orderType, tableNumber, status, paymentStatus
OrderItem       orderId, menuItemId, nameAr, nameEn, quantity, unitPrice, variant, notes
```

## API Endpoints

```
POST   /api/auth/login              → { user, token }
GET    /api/categories              → Category[]
POST   /api/categories              → Category (admin)
PATCH  /api/categories/:id          → Category (admin)
DELETE /api/categories/:id          → void (admin)
GET    /api/menu-items              → MenuItem[]
GET    /api/menu-items/:id          → MenuItem
POST   /api/menu-items              → MenuItem (admin)
PATCH  /api/menu-items/:id          → MenuItem (admin)
DELETE /api/menu-items/:id          → void (admin)
GET    /api/orders                  → Order[]
GET    /api/orders/:id              → Order
GET    /api/orders/by-number/:num   → Order
POST   /api/orders                  → Order (public, rate-limited)
PATCH  /api/orders/:id/status       → Order
GET    /api/users                   → User[] (admin)
POST   /api/users                   → User (admin)
PATCH  /api/users/:id/toggle-active → User (admin)
DELETE /api/users/:id               → void (admin)
GET    /api/dashboard/stats         → DashboardStats (admin)
POST   /api/upload/image            → { url } (admin)
```

## Authentication Flow

1. `POST /api/auth/login` with email + password
2. Server validates with bcrypt, returns JWT token (24h expiry)
3. Frontend stores token in localStorage
4. All subsequent requests include `Authorization: Bearer <token>`
5. `JwtAuthGuard` validates token, `RolesGuard` checks role

## Real-Time Updates

- Socket.io gateway broadcasts `order:new` and `order:updated` events
- Kitchen screen polls every 5s as fallback
- WebSocket connection: `ws://localhost:3001`

## Running Locally

```bash
# Start database + MinIO
docker-compose up -d postgres minio

# Run API
cd apps/api
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# Run frontend
npm run dev
```

## Docker Deployment

```bash
docker-compose up -d
# API: http://localhost:3001
# Web: http://localhost:80
# MinIO Console: http://localhost:9001
```

## Default Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@tastytable.com | password123 | admin |
| kitchen@tastytable.com | password123 | kitchen_staff |

## Status Flow

```
received → preparing → ready → completed
```

## Key Decisions

1. **JWT over sessions** — stateless auth, scales horizontally
2. **Prisma over TypeORM** — better DX, type safety, migration management
3. **MinIO over Cloudinary** — S3-compatible, self-hosted, no vendor lock-in
4. **Socket.io over SSE** — bidirectional, handles reconnection, room-based broadcasting
5. **Docker Compose over K8s** — right size for single-restaurant deployment
6. **Feature-based frontend structure** — each feature is self-contained
7. **RTL-first design** — Arabic is primary language
8. **Mobile-first responsive** — most customers order from phones
