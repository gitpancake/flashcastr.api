# Leaderboard API Documentation

## Overview

The leaderboard endpoint returns a ranked list of Flashcastr users based on their flash count and unique city count. Users are displayed with their Farcaster social profile data (username and profile picture).

## GraphQL Query

```graphql
query GetLeaderboard($limit: Int) {
  getLeaderboard(limit: $limit) {
    username
    pfp_url
    flash_count
    city_count
  }
}
```

## Parameters

| Parameter | Type | Default | Max | Required | Description |
|-----------|------|---------|-----|----------|-------------|
| `limit` | Int | 100 | 500 | No | Number of leaderboard entries to return |

## Response Type

```typescript
type LeaderboardEntry = {
  username: string;       // Farcaster username
  pfp_url: string | null; // Farcaster profile picture URL (nullable)
  flash_count: number;    // Total number of flashes
  city_count: number;     // Number of unique cities visited
}

// Returns: LeaderboardEntry[]
```

## Example Response

```json
{
  "data": {
    "getLeaderboard": [
      {
        "username": "dwr",
        "pfp_url": "https://i.imgur.com/abc123.jpg",
        "flash_count": 1250,
        "city_count": 45
      },
      {
        "username": "v",
        "pfp_url": "https://i.imgur.com/xyz789.png",
        "flash_count": 980,
        "city_count": 52
      },
      {
        "username": "jessepollak",
        "pfp_url": null,
        "flash_count": 750,
        "city_count": 38
      }
    ]
  }
}
```

## Sorting

Results are **automatically sorted** by the API:
1. **Primary:** `flash_count` (descending)
2. **Secondary:** `city_count` (descending)

No client-side sorting is required.

## Caching Behavior

- **Server-side cache:** 1 hour TTL
- **Cache refresh:** Automatic after expiration
- **Performance:** <50ms for cached requests, ~200ms for fresh queries

## Implementation Examples

### React with Apollo Client

```tsx
import { gql, useQuery } from '@apollo/client';

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
  const { loading, error, data } = useQuery(GET_LEADERBOARD, {
    variables: { limit: 50 }
  });

  if (loading) return <div>Loading leaderboard...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="leaderboard">
      <h2>Top Players</h2>
      {data.getLeaderboard.map((entry, index) => (
        <div key={entry.username} className="leaderboard-entry">
          <span className="rank">#{index + 1}</span>

          {entry.pfp_url ? (
            <img
              src={entry.pfp_url}
              alt={entry.username}
              className="avatar"
            />
          ) : (
            <div className="avatar-placeholder">👤</div>
          )}

          <span className="username">@{entry.username}</span>
          <span className="stats">
            {entry.flash_count} flashes · {entry.city_count} cities
          </span>
        </div>
      ))}
    </div>
  );
}
```

### Vanilla JavaScript

```javascript
async function fetchLeaderboard(limit = 100) {
  const response = await fetch('YOUR_GRAPHQL_ENDPOINT', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query GetLeaderboard($limit: Int) {
          getLeaderboard(limit: $limit) {
            username
            pfp_url
            flash_count
            city_count
          }
        }
      `,
      variables: { limit }
    })
  });

  const { data, errors } = await response.json();

  if (errors) {
    console.error('GraphQL errors:', errors);
    throw new Error(errors[0].message);
  }

  return data.getLeaderboard;
}

// Usage
try {
  const leaderboard = await fetchLeaderboard(25);

  leaderboard.forEach((entry, index) => {
    console.log(
      `#${index + 1}: @${entry.username} - ` +
      `${entry.flash_count} flashes in ${entry.city_count} cities`
    );
  });
} catch (error) {
  console.error('Failed to fetch leaderboard:', error);
}
```

### Next.js with Server Components

```tsx
// app/leaderboard/page.tsx
import { gql } from '@apollo/client';
import { getClient } from '@/lib/apollo-client';

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

export default async function LeaderboardPage() {
  const { data } = await getClient().query({
    query: GET_LEADERBOARD,
    variables: { limit: 100 }
  });

  return (
    <div>
      <h1>Leaderboard</h1>
      {data.getLeaderboard.map((entry, index) => (
        <LeaderboardEntry
          key={entry.username}
          rank={index + 1}
          {...entry}
        />
      ))}
    </div>
  );
}
```

## Edge Cases & Error Handling

### Null Profile Pictures

Some users may not have a profile picture (`pfp_url: null`). Always provide a fallback:

```tsx
{entry.pfp_url ? (
  <img src={entry.pfp_url} alt={entry.username} />
) : (
  <DefaultAvatar />
)}
```

### Users with Zero Flashes

Users who signed up but haven't logged flashes yet will appear with:
```json
{
  "username": "newuser",
  "pfp_url": "https://...",
  "flash_count": 0,
  "city_count": 0
}
```

### Empty Leaderboard

If no users exist, the endpoint returns an empty array:
```json
{
  "data": {
    "getLeaderboard": []
  }
}
```

### Limit Validation

- Limits < 1 are automatically set to 1
- Limits > 500 are automatically capped at 500
- No error is thrown for invalid limits

## UI/UX Best Practices

### 1. Avatar Display
```css
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
```

### 2. Top 3 Highlighting
```tsx
const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1: return { color: '#FFD700', label: '🥇' }; // Gold
    case 2: return { color: '#C0C0C0', label: '🥈' }; // Silver
    case 3: return { color: '#CD7F32', label: '🥉' }; // Bronze
    default: return { color: '#666', label: `#${rank}` };
  }
};
```

### 3. Username Links
Consider linking usernames to Farcaster profiles:
```tsx
<a
  href={`https://warpcast.com/${entry.username}`}
  target="_blank"
  rel="noopener noreferrer"
>
  @{entry.username}
</a>
```

### 4. Pagination Strategy
For better UX, load progressively:
```tsx
const [limit, setLimit] = useState(25);

const loadMore = () => setLimit(prev => Math.min(prev + 25, 500));
```

### 5. Loading States
```tsx
{loading && (
  <div className="skeleton-loader">
    {[...Array(10)].map((_, i) => (
      <SkeletonEntry key={i} />
    ))}
  </div>
)}
```

## Performance Considerations

- **Initial Load:** Request top 25-50 entries
- **Load More:** Increase limit incrementally (25 → 50 → 100)
- **Refresh Rate:** Match server cache (1 hour) or use polling
- **Image Optimization:** Use Next.js `<Image>` or similar with lazy loading

## Common Query Patterns

```graphql
# Top 10 players
query { getLeaderboard(limit: 10) { username pfp_url flash_count city_count } }

# Top 100 (default)
query { getLeaderboard { username pfp_url flash_count city_count } }

# Maximum allowed (500)
query { getLeaderboard(limit: 500) { username pfp_url flash_count city_count } }
```

## Related Endpoints

- `flashesSummary(fid: Int!)` - Get stats for a specific user
- `users(username: String, fid: Int)` - Look up user details
- `getTrendingCities()` - Most active cities recently

## Troubleshooting

### Issue: Profile pictures not loading

**Solution:** Check CORS settings and ensure images are served over HTTPS. Consider using a proxy or CDN.

### Issue: Stale data after user adds flashes

**Solution:** The cache refreshes hourly. For real-time updates, implement GraphQL subscriptions or websockets (future feature).

### Issue: Usernames appear as null

**Solution:** This indicates the user hasn't completed Farcaster signup. Display a placeholder like "Anonymous User" or filter these entries client-side.

## Support

For questions or feature requests, contact the backend team or open an issue in the repository.
