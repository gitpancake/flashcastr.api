# CLAUDE.md - Flashcastr API

This document provides guidance for AI assistants working on the Flashcastr API codebase.

## Project Overview

**Flashcastr API** is a production-ready GraphQL API server for managing Flash Invaders game data with Farcaster social integration. It provides endpoints for user management, flash data retrieval, leaderboards, progress tracking, and signup workflows.

**Tech Stack:**
- Node.js (>=19.9.0) + TypeScript 5.4.4 (strict mode)
- Apollo Server 3.12.0 + GraphQL 16.8.1
- PostgreSQL via Prisma ORM 5.12.0
- Neynar SDK for Farcaster integration
- AES-256-GCM encryption for signer keys

## Quick Commands

```bash
# Install dependencies
yarn install

# Generate Prisma client (required after schema changes)
yarn prisma generate

# Run database migrations
yarn prisma migrate dev

# Development server (hot reload)
yarn dev

# Production build and start
yarn build
yarn start
```

Server runs at `http://localhost:4000` with GraphQL introspection enabled.

## Directory Structure

```
src/
├── index.ts                    # Main server: GraphQL schema, resolvers, Apollo setup
└── utils/
    ├── api.invaders.fun/       # External Flash Invaders API wrapper
    │   ├── base.ts             # Base Axios client
    │   └── flashes.ts          # Flash data queries
    ├── auth.ts                 # API key verification middleware
    ├── database/
    │   ├── postgres.ts         # Abstract base class for DB operations
    │   ├── postgresClient.ts   # Connection pool initialization
    │   ├── users/              # User CRUD operations
    │   ├── flashes/            # Flash query operations
    │   └── flashcastr/         # Flashcastr-specific operations
    ├── encrypt/
    │   └── encrypt.ts          # AES-256-GCM encryption utilities
    ├── ipfs.ts                 # IPFS URL construction
    ├── neynar/                 # Farcaster/Neynar SDK utilities
    │   ├── client.ts           # Neynar client configuration
    │   ├── getFid.ts           # Fetch FID from mnemonic
    │   └── getSignedKey.ts     # Signer key creation
    └── tasks/
        └── signup.ts           # Signup workflow operations

prisma/
└── schema.prisma               # Database schema definition
```

## Database Schema

Three core tables:

- **`flashcastr_users`**: User accounts (fid as PK, username, signer_uuid, auto_cast flag, soft delete)
- **`flashcastr_flashes`**: User-captured flashes with cached Farcaster data (denormalized for performance)
- **`flashes`**: Global flash data (flash_id, city, player, S3 img, IPFS CID, timestamp)

Key patterns:
- Soft deletes via `deleted` boolean
- Denormalized user data reduces N+1 queries
- Composite indexes for common filter/sort patterns
- Descending timestamp indexes for "latest first" queries

## Architecture Patterns

### Database Layer
Abstract `Postgres<T>` base class provides type-safe `query()` and `queryOne()` methods. Specialized classes per domain: `PostgresFlashcastrUsers`, `PostgresFlashes`, `PostgresFlashcastrFlashes`.

### Authentication
API key in `X-API-KEY` header, verified via `verifyApiKey(context)`. Only required for mutations (user management).

### Caching
In-memory caching with TTL:
- Leaderboard: 1-hour TTL
- Trending cities: 24-hour TTL

### Error Handling
GraphQL errors with extensions containing codes: `UNAUTHENTICATED`, `BAD_USER_INPUT`, `DATABASE_ERROR`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`.

## Key Conventions

### Type Conversions
```typescript
// BigInt to String for GraphQL
flash_id: String(flash.flash_id)

// String to BigInt for database
flash_id: BigInt(args.flash_id)
```

### Case-Insensitive Filtering
```typescript
city: { equals: args.city, mode: 'insensitive' }
```

### Pagination Defaults
- page=1, limit=20
- Formula: `skip: (page - 1) * limit, take: limit`

### Soft Delete Pattern
Always filter with `deleted: false` in queries:
```typescript
where: { deleted: false, flashcastr_users: { deleted: false } }
```

## API Reference

### Public Queries
- `users(username?, fid?)` - Get users
- `flash(id!)` - Single flash by DB ID
- `flashes(page?, limit?, fid?, username?, city?)` - User flashes with filtering
- `globalFlashes(page?, limit?, city?, player?)` - All flashes
- `globalFlash(flash_id!)` - Single flash by flash_id
- `flashesSummary(fid!, page?, limit?)` - Flash count and cities
- `getAllCities` - Distinct city list
- `allFlashesPlayers(username?)` - Player names for autocomplete
- `getTrendingCities(excludeParis?, hours?)` - Top 10 trending (24h cache)
- `getLeaderboard(limit?)` - User rankings (1h cache, max 500)
- `progress(fid!, days!, order?)` - Daily activity for heatmaps (1-30 days)
- `pollSignupStatus(signer_uuid!, username!)` - Check signup approval

### Protected Mutations (require X-API-KEY)
- `setUserAutoCast(fid!, auto_cast!)` - Update auto-cast preference
- `deleteUser(fid!)` - Soft delete user and flashes

### Public Mutations
- `initiateSignup(username!)` - Start Farcaster signup flow

## Environment Variables

**Required:**
```env
DATABASE_URL              # PostgreSQL connection string
NEYNAR_API_KEY           # Neynar SDK authentication
INVADERS_API_URL         # Flash Invaders GraphQL endpoint
API_KEY                  # X-API-KEY for protected mutations
SIGNER_ENCRYPTION_KEY    # 32-byte hex AES-256 key
FARCASTER_DEVELOPER_MNEMONIC  # 12-word mnemonic for signer creation
```

**Optional:**
```env
NODE_ENV                 # development/production (default: development)
PORT                     # Server port (default: 4000)
IPFS_GATEWAY            # IPFS gateway URL (default: Pinata)
```

## Common Development Tasks

### Adding a New Query
1. Add type definition to `typeDefs` in `src/index.ts`
2. Add resolver function to `resolvers.Query`
3. Create database method if needed in appropriate `utils/database/` class

### Adding a New Mutation
1. Add type definition to `typeDefs`
2. Add resolver to `resolvers.Mutation`
3. Call `verifyApiKey(context)` if authentication required

### Database Schema Changes
1. Update `prisma/schema.prisma`
2. Run `yarn prisma migrate dev --name descriptive_name`
3. Run `yarn prisma generate`

### Adding External API Integration
1. Create new directory in `src/utils/`
2. Extend `BaseApi` class from `api.invaders.fun/base.ts`
3. Configure base URL via environment variable

## Testing

No explicit test suite - TypeScript compilation ensures type safety. Build validation:
```bash
yarn build  # Catches type errors
```

## Security Notes

- Never commit `.env` files or expose API keys
- API key should be 32+ characters
- Encryption key must be 32-byte hex (64 characters)
- Use parameterized queries (Prisma handles this)
- Soft deletes preserve data integrity
