# Flashcastr API

A GraphQL API server for managing Flash Invaders game data and Farcaster integration. This service provides endpoints for user management, flash data retrieval, and signup processes with support for both traditional S3 image storage and IPFS content delivery.

## Features

- **GraphQL API** with Apollo Server
- **Farcaster Integration** via Neynar SDK
- **Database Management** with Prisma ORM (PostgreSQL)
- **Dual Image Storage** - S3 and IPFS support
- **User Management** - Signup, authentication, and profile management
- **Flash Data** - Retrieve and manage Flash Invaders game data
- **TypeScript** - Fully typed codebase
- **Pre-commit Hooks** - Automatic build validation

## Tech Stack

- **Runtime**: Node.js >=19.9.0
- **Language**: TypeScript
- **GraphQL**: Apollo Server v3
- **Database**: PostgreSQL with Prisma ORM
- **External APIs**: 
  - Neynar (Farcaster)
  - Flash Invaders API
  - IPFS (Pinata Gateway)
- **Package Manager**: Yarn

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
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/flashcastr"

# External APIs
NEYNAR_API_KEY="your_neynar_api_key"
INVADERS_API_URL="https://api.invaders.example.com"

# Authentication
API_KEY="your_secure_api_key"

# Farcaster
FARCASTER_DEVELOPER_MNEMONIC="your_farcaster_developer_mnemonic"

# Encryption
SIGNER_ENCRYPTION_KEY="your_signer_encryption_key"

# Environment
NODE_ENV="development"
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

- `users(username: String, fid: Int): [User!]!` - Get users by username or FID
- `flashes(page: Int, limit: Int, fid: Int, username: String): [FlashcastrFlash!]!` - Get paginated flashes
- `flash(id: Int!): FlashcastrFlash` - Get single flash by ID
- `flashesSummary(fid: Int!, page: Int, limit: Int): FlashesSummary!` - Get flash statistics
- `allFlashesPlayers(username: String): [String!]!` - Get all player names
- `pollSignupStatus(signer_uuid: String!, username: String!): PollSignupStatusResponse!` - Check signup status

### Mutations

- `setUserAutoCast(fid: Int!, auto_cast: Boolean!): User!` - Update user auto-cast setting
- `deleteUser(fid: Int!): DeleteUserResponse!` - Delete user account
- `initiateSignup(username: String!): InitiateSignupResponse!` - Start signup process
- `signup(fid: Int!, signer_uuid: String!, username: String!): SignupResponse!` - Complete signup

## Image Handling

The API supports dual image storage:

1. **Traditional S3**: Using the `img` field (legacy)
2. **IPFS**: Using the `ipfs_cid` field (new)

### IPFS Integration

- **Gateway**: `https://fuchsia-rich-lungfish-648.mypinata.cloud`
- **URL Construction**: `https://fuchsia-rich-lungfish-648.mypinata.cloud/ipfs/{cid}`
- **Client Decision**: Frontend applications can choose which image source to use

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

API endpoints requiring authentication use the `API_KEY` environment variable. Include the API key in requests via the context/headers as configured by your client.

## Git Hooks

The repository includes a pre-commit hook that automatically runs the build process to ensure code quality:

- **Location**: `.git/hooks/pre-commit`
- **Action**: Runs `yarn build` before each commit
- **Behavior**: Prevents commits if build fails

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all tests pass and build succeeds
5. Submit a pull request

The pre-commit hook will automatically validate your changes before they're committed.

## License

[Add your license information here]