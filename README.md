# Flashcastr API

A production-ready GraphQL API server for managing Flash Invaders game data and Farcaster social integration. This service provides comprehensive endpoints for user management, flash data retrieval, leaderboards, progress tracking, and signup workflows with dual image storage support.

## Features

- **GraphQL API** with Apollo Server v3 and comprehensive schema
- **Farcaster Integration** via Neynar SDK for social authentication
- **Database Management** with Prisma ORM and PostgreSQL
- **Dual Image Storage** - Traditional S3 URLs and decentralized IPFS support
- **User Management** - Complete signup workflows and profile management
- **Performance Optimization** - Memory caching, database indexing, and query optimization
- **Real-time Data** - Leaderboards, trending cities, and progress tracking
- **TypeScript** - Fully typed codebase with strict type checking
- **Production Ready** - Error handling, authentication, and monitoring

## Tech Stack

- **Runtime**: Node.js >=19.9.0
- **Language**: TypeScript with strict mode
- **GraphQL**: Apollo Server v3 with introspection
- **Database**: PostgreSQL with Prisma ORM and optimized indexing
- **Caching**: In-memory caching with TTL strategies
- **External APIs**: 
  - Neynar SDK (Farcaster social data)
  - Flash Invaders API (game data)
  - IPFS via Pinata (decentralized storage)
- **Package Manager**: Yarn v1.22.22
- **Security**: API key authentication and encrypted signer storage

## Prerequisites

- Node.js >=19.9.0
- PostgreSQL database
- Yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd flashcastr.api
```

2. Install dependencies:
```bash
yarn install
```

3. Set up environment variables (see [Environment Variables](#environment-variables))

4. Generate Prisma client:
```bash
yarn prisma generate
```

5. Run database migrations (if applicable):
```bash
yarn prisma migrate dev
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/flashcastr"

# External API Keys
NEYNAR_API_KEY="your_neynar_api_key_here"
INVADERS_API_URL="https://api.space-invaders.com"

# Authentication & Security
API_KEY="your_secure_api_key_32_chars_min"
SIGNER_ENCRYPTION_KEY="your_32_byte_hex_encryption_key"

# Farcaster Configuration
FARCASTER_DEVELOPER_MNEMONIC="your twelve word mnemonic phrase for farcaster signer creation"

# Server Configuration
NODE_ENV="development"
PORT=4000
```

## Development

Start the development server:
```bash
yarn dev
```

The GraphQL server will be available at `http://localhost:4000`

## Production

Build the application:
```bash
yarn build
```

Start the production server:
```bash
yarn start
```

## GraphQL Schema

### Types

#### User
```graphql
type User {
  fid: Int!
  username: String
  auto_cast: Boolean
}
```

#### Flash
```graphql
type Flash {
  flash_id: ID!
  city: String
  player: String
  img: String        # S3 image URL/key
  ipfs_cid: String   # IPFS content identifier
  text: String
  timestamp: String
  flash_count: String
}
```

#### FlashcastrFlash
```graphql
type FlashcastrFlash {
  id: Int!
  flash_id: String!
  user_fid: Int!
  user_username: String
  user_pfp_url: String
  cast_hash: String
  flash: Flash!
}
```

### Queries

#### Core Queries
- `users(username: String, fid: Int): [User!]!` - Get users by username or FID
- `flashes(page: Int, limit: Int, fid: Int, username: String, city: String): [FlashcastrFlash!]!` - Get paginated flashes with filtering
- `globalFlashes(page: Int, limit: Int, city: String, player: String): [Flash!]!` - Get global flash data with city/player filters
- `flash(id: Int!): FlashcastrFlash` - Get single flash by ID
- `globalFlash(flash_id: String!): Flash` - Get global flash by flash_id

#### Analytics & Stats
- `flashesSummary(fid: Int!): FlashesSummary!` - Get user flash statistics and cities
- `getLeaderboard(limit: Int = 100): [LeaderboardEntry!]!` - Get user rankings (cached 1h)
- `getTrendingCities(excludeParis: Boolean = true, hours: Int = 6): [TrendingCity!]!` - Get trending cities (cached 24h)
- `progress(fid: Int!, days: Int!, order: String = "ASC"): [DailyProgress!]!` - Get daily activity heatmap data
- `getAllCities: [String!]!` - Get complete list of cities
- `allFlashesPlayers(username: String): [String!]!` - Get player names for autocomplete

#### Authentication
- `pollSignupStatus(signer_uuid: String!, username: String!): PollSignupStatusResponse!` - Poll signup status

### Mutations

- `setUserAutoCast(fid: Int!, auto_cast: Boolean!): User!` - Update user auto-cast preference (requires API key)
- `deleteUser(fid: Int!): DeleteUserResponse!` - Delete user account and associated data (requires API key)
- `initiateSignup(username: String!): InitiateSignupResponse!` - Start Farcaster signup process
- `signup(fid: Int!, signer_uuid: String!, username: String!): SignupResponse!` - Complete signup (deprecated - use initiateSignup + pollSignupStatus)

## Image Handling

The API supports dual image storage:

1. **Traditional S3**: Using the `img` field (legacy)
2. **IPFS**: Using the `ipfs_cid` field (new)

### IPFS Integration

- **Gateway**: `https://fuchsia-rich-lungfish-648.mypinata.cloud` (configurable via IPFS_GATEWAY env)
- **URL Construction**: `https://fuchsia-rich-lungfish-648.mypinata.cloud/ipfs/{cid}`
- **Client Decision**: Frontend applications can choose which image source to use
- **Backup Strategy**: S3 URLs provide fallback when IPFS is unavailable

The API returns both fields without transformation, allowing clients to:
- Use S3 URLs for immediate compatibility
- Use IPFS for decentralized content delivery
- Implement fallback strategies

## Database Schema

### Tables

- `flashcastr_users` - User accounts and settings
- `flashcastr_flashes` - User-flash relationships with cast data
- `flashes` - Flash Invaders game data with image references

### Key Relationships

- Users can have multiple flashes
- Each flash references the original Flash Invaders data
- Flash data includes both S3 and IPFS image references

## Authentication

### Public Endpoints
Most query operations are public and don't require authentication:
- All flash data queries (`flashes`, `globalFlashes`, etc.)
- Analytics queries (`getLeaderboard`, `getTrendingCities`, `progress`)
- User lookup (`users`)
- Signup initiation (`initiateSignup`, `pollSignupStatus`)

### Protected Endpoints
User management mutations require API key authentication:
- `setUserAutoCast` - Update user preferences
- `deleteUser` - Account deletion

**Authentication Method:**
```typescript
// Include API key in request headers
headers: {
  'X-API-KEY': 'your_api_key_here'
}
```

**Error Response:**
```json
{
  "errors": [{
    "message": "Unauthorized",
    "extensions": { "code": "UNAUTHENTICATED" }
  }]
}
```

## Performance & Caching

### Server-Side Caching
- **Trending Cities**: 24-hour TTL for trending city calculations
- **Leaderboard**: 1-hour TTL for user rankings and statistics
- **Database Indexes**: Optimized indexes for common query patterns

### Database Optimization
- **Connection Pooling**: Efficient PostgreSQL connection management
- **Query Optimization**: Direct SQL for complex aggregations
- **Indexed Queries**: Strategic indexing for timestamp and user-based queries

### API Performance
- **Average Response Time**: <100ms for cached queries, <500ms for database queries
- **Concurrent Requests**: Supports high concurrent load with connection pooling
- **Error Handling**: Comprehensive error responses with specific error codes

## Project Structure

```
src/
├── index.ts                 # Main GraphQL server and resolvers
├── utils/
│   ├── api.invaders.fun/    # External API integration
│   │   ├── base.ts          # Base API client
│   │   └── flashes.ts       # Flash Invaders API
│   ├── auth.ts              # Authentication utilities
│   ├── database/            # Database layer
│   │   ├── flashcastr/      # Flashcastr-specific queries
│   │   ├── flashes/         # Flash data queries
│   │   ├── users/           # User management queries
│   │   ├── postgres.ts      # Base PostgreSQL class
│   │   └── postgresClient.ts # Database connection
│   ├── encrypt/             # Encryption utilities
│   ├── ipfs.ts              # IPFS URL utilities
│   ├── neynar/              # Farcaster/Neynar integration
│   └── tasks/               # Background task handlers
│       └── signup.ts        # User signup workflows
```

## API Usage Examples

### React with Apollo Client
```typescript
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const GET_LEADERBOARD = gql`
  query GetLeaderboard($limit: Int) {
    getLeaderboard(limit: $limit) {
      username
      pfp_url
      flash_count
      city_count
    }
  }
`;

function Leaderboard() {
  const { data, loading, error } = useQuery(GET_LEADERBOARD, {
    variables: { limit: 50 }
  });
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {data.getLeaderboard.map((entry, index) => (
        <div key={entry.username}>
          #{index + 1} {entry.username} - {entry.flash_count} flashes
        </div>
      ))}
    </div>
  );
}
```

### Direct HTTP Request
```javascript
const response = await fetch('http://localhost:4000/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      query GetFlashes($page: Int, $limit: Int) {
        flashes(page: $page, limit: $limit) {
          flash_id
          user_username
          flash {
            city
            player
            timestamp
          }
        }
      }
    `,
    variables: { page: 1, limit: 20 }
  })
});

const { data } = await response.json();
```

## Observability

### Prometheus Metrics

The API exposes Prometheus metrics on port 9092:

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
- `flashcastr_api_cache_hits_total{cache_name}` - Cache hits
- `flashcastr_api_cache_misses_total{cache_name}` - Cache misses
- `flashcastr_api_neynar_requests_total{endpoint, status}` - Neynar API calls
- `flashcastr_api_active_users_total` - Active user count (gauge)
- `flashcastr_api_total_flashes` - Total flashes (gauge)
- `flashcastr_api_uptime_seconds` - Service uptime
- `flashcastr_api_memory_bytes{type}` - Memory usage

### Distributed Tracing

The API sends distributed traces to Tempo via OpenTelemetry Protocol (OTLP).

**Environment variable:**
```env
TEMPO_HTTP_ENDPOINT=http://tempo.railway.internal:4318/v1/traces
```

**Auto-instrumented:**
- HTTP requests
- GraphQL operations
- PostgreSQL queries

When `TEMPO_HTTP_ENDPOINT` is not set, tracing is disabled.

## Deployment

### Environment Setup
1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations: `yarn prisma migrate deploy`
4. Generate Prisma client: `yarn prisma generate`
5. Build application: `yarn build`
6. Start server: `yarn start`

### Production Considerations
- Configure proper `DATABASE_URL` for production database
- Set up proper CORS policies for your frontend domain
- Use environment-specific API keys
- Enable database connection pooling
- Set up monitoring and logging

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests: `yarn build` (ensure no TypeScript errors)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Support

For questions, bug reports, or feature requests:
- Create an issue on GitHub
- Check existing documentation in `/docs`
- Review the GraphQL schema at `http://localhost:4000/graphql`

## License

ISC License - see LICENSE file for details