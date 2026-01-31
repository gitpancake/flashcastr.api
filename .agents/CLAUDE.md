# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

Flashcastr API is a GraphQL API that powers the Flashcastr application - a service for tracking Space Invaders street art flashes and auto-posting to Farcaster.

## Tech Stack

- **Runtime**: Node.js >= 19.9.0
- **Language**: TypeScript (strict mode)
- **API**: GraphQL with Apollo Server
- **Database**: PostgreSQL with Prisma ORM
- **Social**: Farcaster integration via Neynar SDK

## Project Structure

```
src/
├── index.ts                    # Main GraphQL server (Apollo + Express)
└── utils/
    ├── auth.ts                 # API key authentication
    ├── metrics/index.ts        # Prometheus metrics server (port 9092)
    ├── ipfs.ts                 # IPFS URL utilities
    ├── api.invaders.fun/       # Space Invaders API client
    ├── database/
    │   ├── postgresClient.ts   # Connection pooling
    │   ├── postgres.ts         # Base Postgres class
    │   ├── flashcastr/         # Flashcastr flash queries
    │   ├── flashes/            # Global flash queries
    │   └── users/              # User management
    ├── neynar/                 # Farcaster/Neynar integration
    │   ├── client.ts
    │   ├── getFid.ts
    │   └── getSignedKey.ts
    ├── encrypt/                # Encryption utilities
    └── tasks/
        └── signup.ts           # User signup workflows
```

## Common Commands

```bash
yarn dev          # Run with ts-node-dev (hot reload)
yarn build        # Compile TypeScript to dist/
yarn start        # Run compiled JS from dist/
yarn prisma       # Run Prisma CLI commands
```

## GraphQL API

The API runs on port 4000 at `/graphql`.

### Queries (Public)
- `users(username?, fid?)` - Get users
- `flashes(page?, limit?, fid?, username?, city?)` - User flashes
- `globalFlashes(page?, limit?, city?, player?)` - All flashes
- `flash(id!)` / `globalFlash(flash_id!)` - Single flash
- `flashesSummary(fid!)` - User flash count & cities
- `getLeaderboard(limit=100)` - Top players (cached 1hr)
- `getTrendingCities(excludeParis?, hours?)` - Trending cities (cached 24hr)
- `progress(fid!, days!, order?)` - Daily activity heatmap
- `getAllCities` - All city names
- `allFlashesPlayers(username?)` - Player autocomplete
- `pollSignupStatus(signer_uuid!, username!)` - Check signup status

### Mutations
- `initiateSignup(username!)` - Start Farcaster signup (public)
- `setUserAutoCast(fid!, auto_cast!)` - Update auto-cast (protected)
- `deleteUser(fid!)` - Delete user (protected)

Protected mutations require `X-API-KEY` header.

## Prometheus Metrics

Metrics are exposed on port 9092:

| Endpoint | Description |
|----------|-------------|
| `GET /metrics` | Prometheus metrics |
| `GET /health` | Health check |

**Key metrics:**
- `flashcastr_api_graphql_requests_total{operation_type, operation_name}` - Request count
- `flashcastr_api_graphql_errors_total{operation_type, operation_name}` - Error count
- `flashcastr_api_graphql_duration_seconds` - Request duration histogram
- `flashcastr_api_signups_initiated_total` - Signup initiations
- `flashcastr_api_signups_completed_total` - Completed signups
- `flashcastr_api_users_deleted_total` - User deletions
- `flashcastr_api_cache_hits_total{cache_name}` - Cache hits (leaderboard, trending_cities)
- `flashcastr_api_cache_misses_total{cache_name}` - Cache misses
- `flashcastr_api_neynar_requests_total{endpoint, status}` - Neynar API calls
- `flashcastr_api_active_users_total` - Active user count (gauge)
- `flashcastr_api_total_flashes` - Total flashes (gauge)
- `flashcastr_api_uptime_seconds` - Service uptime
- `flashcastr_api_memory_bytes{type}` - Memory usage

## Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEYNAR_API_KEY` - Neynar API authentication
- `SIGNER_ENCRYPTION_KEY` - Key for encrypting signer UUIDs

**Optional:**
- `API_KEY` - API key for protected mutations

## Caching

- **Leaderboard**: 1-hour TTL in-memory cache
- **Trending Cities**: 24-hour TTL in-memory cache

## Data Models

**flashcastr_users**: User accounts with Farcaster signer
**flashcastr_flashes**: User-flash relationships with cast hashes
**flashes**: Global flash data from Space Invaders API

## Distributed Tracing (OpenTelemetry)

The API sends distributed traces to Tempo via OpenTelemetry Protocol (OTLP).

**Tracing initialization** is in `src/utils/tracing/index.ts` and must be imported at the very top of `src/index.ts` before any other imports.

**Environment variable:**
- `TEMPO_HTTP_ENDPOINT` - Tempo OTLP endpoint (e.g., `http://tempo.railway.internal:4318/v1/traces`)

**Auto-instrumented:**
- HTTP requests
- GraphQL operations
- PostgreSQL queries

When `TEMPO_HTTP_ENDPOINT` is not set, tracing is disabled and no traces are sent.
