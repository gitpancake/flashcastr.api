# Progress Heatmap - Frontend Implementation Guide

## Overview
The Progress tab displays a user's daily flash activity over a configurable time period (7-30 days) in two views:
1. **Heatmap View**: Visual calendar-style grid showing activity intensity
2. **List View**: Chronological list with counts per day

## API Endpoint

### GraphQL Query

```graphql
type DailyProgress {
  date: String!      # ISO date format: "2025-10-30"
  count: Int!        # Number of flashes captured that day
}

type Query {
  progress(fid: Int!, days: Int!, order: String = "ASC"): [DailyProgress!]!
}
```

### Parameters

| Parameter | Type | Required | Default | Valid Values | Description |
|-----------|------|----------|---------|--------------|-------------|
| `fid` | Int | Yes | - | Any valid Farcaster ID | User's Farcaster ID |
| `days` | Int | Yes | - | 1-30 | Number of days to fetch |
| `order` | String | No | "ASC" | "ASC", "DESC" | Sort order (oldest→newest or newest→oldest) |

### Example Request

```graphql
query GetUserProgress($fid: Int!, $days: Int!, $order: String) {
  progress(fid: $fid, days: $days, order: $order) {
    date
    count
  }
}
```

### Example Response

```json
{
  "data": {
    "progress": [
      { "date": "2025-10-24", "count": 0 },
      { "date": "2025-10-25", "count": 3 },
      { "date": "2025-10-26", "count": 0 },
      { "date": "2025-10-27", "count": 5 },
      { "date": "2025-10-28", "count": 1 },
      { "date": "2025-10-29", "count": 0 },
      { "date": "2025-10-30", "count": 2 }
    ]
  }
}
```

### Error Handling

**Invalid days parameter:**
```json
{
  "errors": [{
    "message": "Days parameter must be between 1 and 30.",
    "extensions": {
      "code": "BAD_USER_INPUT",
      "argumentName": "days"
    }
  }]
}
```

**Invalid order parameter:**
```json
{
  "errors": [{
    "message": "Order parameter must be 'ASC' or 'DESC'.",
    "extensions": {
      "code": "BAD_USER_INPUT",
      "argumentName": "order"
    }
  }]
}
```

---

## UI/UX Design Recommendations

### Layout Structure

```
┌─────────────────────────────────────────────┐
│  Progress                         [≡] [█]   │  ← Tab header with view toggles
├─────────────────────────────────────────────┤
│  [ 7 Days ] [ 14 Days ] [ 30 Days ]        │  ← Time range selector
├─────────────────────────────────────────────┤
│                                             │
│         HEATMAP or LIST VIEW                │  ← Content area
│                                             │
│  Total: 11 flashes • 4 active days          │  ← Summary stats
└─────────────────────────────────────────────┘
```

### View Toggle Controls

**Icons:**
- **List View**: Three horizontal lines (≡)
- **Heatmap View**: Grid icon (█)

**State:**
- Active view: Primary color (e.g., purple/blue)
- Inactive view: Gray

---

## Heatmap View Implementation

### Visual Design

**GitHub-style contribution graph:**

```
    Mon  Tue  Wed  Thu  Fri  Sat  Sun
W1   0    3    0    5    1    0    2
W2   0    0    4    0    2    1    3
W3   1    0    0    6    2    0    0
W4   0    5    1    0    0    3    2
```

### Color Intensity Scale

**Recommended scale (0-5+ flashes):**

| Count | Color | Description |
|-------|-------|-------------|
| 0 | `#ebedf0` (light gray) | No activity |
| 1-2 | `#9be9a8` (light green) | Low activity |
| 3-4 | `#40c463` (medium green) | Moderate activity |
| 5-6 | `#30a14e` (green) | High activity |
| 7+ | `#216e39` (dark green) | Very high activity |

**Alternative: Custom brand colors**
- Use your app's color palette
- Maintain clear contrast between levels
- Ensure accessibility (WCAG AA minimum)

### Component Structure (React Example)

```tsx
import React, { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { format, startOfWeek, eachDayOfInterval, subDays } from 'date-fns';

interface DailyProgress {
  date: string;
  count: number;
}

interface HeatmapProps {
  fid: number;
  days: 7 | 14 | 30;
}

const PROGRESS_QUERY = gql`
  query GetUserProgress($fid: Int!, $days: Int!) {
    progress(fid: $fid, days: $days, order: "ASC") {
      date
      count
    }
  }
`;

export function ProgressHeatmap({ fid, days }: HeatmapProps) {
  const { data, loading, error } = useQuery(PROGRESS_QUERY, {
    variables: { fid, days },
  });

  const heatmapData = useMemo(() => {
    if (!data?.progress) return [];
    return organizeIntoWeeks(data.progress);
  }, [data]);

  if (loading) return <HeatmapSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="heatmap-container">
      <WeekdayLabels />
      <div className="heatmap-grid">
        {heatmapData.map((week, weekIndex) => (
          <div key={weekIndex} className="heatmap-week">
            {week.map((day) => (
              <HeatmapCell
                key={day.date}
                date={day.date}
                count={day.count}
              />
            ))}
          </div>
        ))}
      </div>
      <SummaryStats data={data.progress} />
    </div>
  );
}

function HeatmapCell({ date, count }: DailyProgress) {
  const intensity = getIntensityLevel(count);
  const color = getColorForIntensity(intensity);

  return (
    <div
      className="heatmap-cell"
      style={{ backgroundColor: color }}
      title={`${format(new Date(date), 'MMM d, yyyy')}: ${count} flashes`}
      data-count={count}
      data-date={date}
    >
      {/* Empty - color shows activity */}
    </div>
  );
}

function getIntensityLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

function getColorForIntensity(level: number): string {
  const colors = [
    '#ebedf0', // 0 flashes
    '#9be9a8', // 1-2
    '#40c463', // 3-4
    '#30a14e', // 5-6
    '#216e39', // 7+
  ];
  return colors[level];
}

function organizeIntoWeeks(progress: DailyProgress[]): DailyProgress[][] {
  const weeks: DailyProgress[][] = [];
  let currentWeek: DailyProgress[] = [];

  progress.forEach((day, index) => {
    currentWeek.push(day);

    // Start new week every 7 days
    if ((index + 1) % 7 === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  // Add remaining days
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}
```

### CSS Styling

```css
.heatmap-container {
  padding: 20px;
}

.heatmap-grid {
  display: flex;
  gap: 4px;
  margin: 16px 0;
}

.heatmap-week {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.heatmap-cell:hover {
  transform: scale(1.2);
  outline: 2px solid rgba(0, 0, 0, 0.3);
}

/* Mobile: Larger cells */
@media (max-width: 768px) {
  .heatmap-cell {
    width: 10px;
    height: 10px;
  }
}
```

### Interactive Features

**Tooltip on Hover:**
- Show full date (e.g., "October 27, 2025")
- Display flash count (e.g., "5 flashes")
- Optional: Show thumbnail of flashes from that day

**Click to View Details:**
```tsx
function HeatmapCell({ date, count, onCellClick }: Props) {
  return (
    <div
      className="heatmap-cell"
      onClick={() => onCellClick(date)}
      // ... other props
    >
      {/* ... */}
    </div>
  );
}

// Parent component
function ProgressHeatmap({ fid, days }: HeatmapProps) {
  const handleCellClick = (date: string) => {
    // Navigate to flashes page filtered by this date
    router.push(`/flashes?fid=${fid}&date=${date}`);
  };

  // ...
}
```

---

## List View Implementation

### Visual Design

```
┌─────────────────────────────────────────┐
│  Thursday, October 24                   │
│  No flashes                              │
├─────────────────────────────────────────┤
│  Friday, October 25              ●●●    │
│  3 flashes                               │
├─────────────────────────────────────────┤
│  Saturday, October 26                   │
│  No flashes                              │
├─────────────────────────────────────────┤
│  Sunday, October 27              ●●●●● │
│  5 flashes                               │
└─────────────────────────────────────────┘
```

### Component Structure (React Example)

```tsx
interface ListViewProps {
  fid: number;
  days: 7 | 14 | 30;
}

export function ProgressListView({ fid, days }: ListViewProps) {
  const { data, loading, error } = useQuery(PROGRESS_QUERY, {
    variables: { fid, days, order: "DESC" }, // Newest first for list
  });

  if (loading) return <ListSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="progress-list">
      {data.progress.map((day) => (
        <ProgressListItem key={day.date} {...day} />
      ))}
      <SummaryStats data={data.progress} />
    </div>
  );
}

function ProgressListItem({ date, count }: DailyProgress) {
  const dateObj = new Date(date);
  const isToday = format(dateObj, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className={`progress-list-item ${count === 0 ? 'inactive' : 'active'}`}>
      <div className="date-section">
        <span className="day-name">
          {format(dateObj, 'EEEE')}
          {isToday && <span className="today-badge">Today</span>}
        </span>
        <span className="date">{format(dateObj, 'MMM d, yyyy')}</span>
      </div>

      <div className="activity-section">
        {count === 0 ? (
          <span className="no-activity">No flashes</span>
        ) : (
          <>
            <div className="activity-dots">
              {Array.from({ length: Math.min(count, 10) }, (_, i) => (
                <span key={i} className="dot">●</span>
              ))}
              {count > 10 && <span className="overflow">+{count - 10}</span>}
            </div>
            <span className="count-text">{count} {count === 1 ? 'flash' : 'flashes'}</span>
          </>
        )}
      </div>
    </div>
  );
}
```

### CSS Styling

```css
.progress-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.progress-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s ease;
}

.progress-list-item.active {
  border-color: #40c463;
  background-color: #f6fff8;
}

.progress-list-item.inactive {
  opacity: 0.5;
}

.progress-list-item:hover {
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.date-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.day-name {
  font-weight: 600;
  font-size: 16px;
  color: #333;
}

.today-badge {
  margin-left: 8px;
  padding: 2px 8px;
  background-color: #ff6b6b;
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.date {
  font-size: 14px;
  color: #666;
}

.activity-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.activity-dots {
  display: flex;
  gap: 4px;
  color: #40c463;
  font-size: 16px;
}

.dot {
  animation: fadeIn 0.3s ease;
}

.overflow {
  font-size: 12px;
  color: #666;
}

.count-text {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.no-activity {
  font-size: 14px;
  color: #999;
  font-style: italic;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0); }
  to { opacity: 1; transform: scale(1); }
}
```

---

## View Toggle Implementation

### Component Structure

```tsx
type ViewMode = 'heatmap' | 'list';

export function ProgressTab({ fid }: { fid: number }) {
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [days, setDays] = useState<7 | 14 | 30>(7);

  return (
    <div className="progress-tab">
      <div className="controls-header">
        <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
      </div>

      <div className="time-range-selector">
        <button
          className={days === 7 ? 'active' : ''}
          onClick={() => setDays(7)}
        >
          7 Days
        </button>
        <button
          className={days === 14 ? 'active' : ''}
          onClick={() => setDays(14)}
        >
          14 Days
        </button>
        <button
          className={days === 30 ? 'active' : ''}
          onClick={() => setDays(30)}
        >
          30 Days
        </button>
      </div>

      {viewMode === 'heatmap' ? (
        <ProgressHeatmap fid={fid} days={days} />
      ) : (
        <ProgressListView fid={fid} days={days} />
      )}
    </div>
  );
}

function ViewToggle({ viewMode, onToggle }: {
  viewMode: ViewMode;
  onToggle: (mode: ViewMode) => void;
}) {
  return (
    <div className="view-toggle">
      <button
        className={viewMode === 'list' ? 'active' : ''}
        onClick={() => onToggle('list')}
        aria-label="List view"
        title="List view"
      >
        <ListIcon />
      </button>
      <button
        className={viewMode === 'heatmap' ? 'active' : ''}
        onClick={() => onToggle('heatmap')}
        aria-label="Heatmap view"
        title="Heatmap view"
      >
        <GridIcon />
      </button>
    </div>
  );
}

// Simple icon components
function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <rect x="3" y="4" width="14" height="2" rx="1" />
      <rect x="3" y="9" width="14" height="2" rx="1" />
      <rect x="3" y="14" width="14" height="2" rx="1" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <rect x="3" y="3" width="4" height="4" rx="1" />
      <rect x="8" y="3" width="4" height="4" rx="1" />
      <rect x="13" y="3" width="4" height="4" rx="1" />
      <rect x="3" y="8" width="4" height="4" rx="1" />
      <rect x="8" y="8" width="4" height="4" rx="1" />
      <rect x="13" y="8" width="4" height="4" rx="1" />
      <rect x="3" y="13" width="4" height="4" rx="1" />
      <rect x="8" y="13" width="4" height="4" rx="1" />
      <rect x="13" y="13" width="4" height="4" rx="1" />
    </svg>
  );
}
```

### CSS Styling

```css
.controls-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.view-toggle {
  display: flex;
  gap: 4px;
  padding: 4px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.view-toggle button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: #666;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-toggle button:hover {
  background-color: #e0e0e0;
}

.view-toggle button.active {
  background-color: #40c463;
  color: white;
}

.time-range-selector {
  display: flex;
  gap: 8px;
  padding: 16px;
  justify-content: center;
}

.time-range-selector button {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  background-color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.time-range-selector button:hover {
  border-color: #40c463;
  background-color: #f6fff8;
}

.time-range-selector button.active {
  border-color: #40c463;
  background-color: #40c463;
  color: white;
}
```

---

## Summary Statistics Component

### Display aggregate data below both views

```tsx
interface SummaryStatsProps {
  data: DailyProgress[];
}

function SummaryStats({ data }: SummaryStatsProps) {
  const stats = useMemo(() => {
    const totalFlashes = data.reduce((sum, day) => sum + day.count, 0);
    const activeDays = data.filter(day => day.count > 0).length;
    const currentStreak = calculateStreak(data);
    const longestStreak = calculateLongestStreak(data);
    const averagePerDay = (totalFlashes / data.length).toFixed(1);

    return { totalFlashes, activeDays, currentStreak, longestStreak, averagePerDay };
  }, [data]);

  return (
    <div className="summary-stats">
      <StatItem label="Total Flashes" value={stats.totalFlashes} />
      <StatItem label="Active Days" value={`${stats.activeDays}/${data.length}`} />
      <StatItem label="Current Streak" value={`${stats.currentStreak} days`} />
      <StatItem label="Longest Streak" value={`${stats.longestStreak} days`} />
      <StatItem label="Daily Average" value={stats.averagePerDay} />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-item">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function calculateStreak(data: DailyProgress[]): number {
  // Calculate current streak from today backwards
  let streak = 0;
  const reversed = [...data].reverse();

  for (const day of reversed) {
    if (day.count > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function calculateLongestStreak(data: DailyProgress[]): number {
  let longest = 0;
  let current = 0;

  for (const day of data) {
    if (day.count > 0) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}
```

### CSS Styling

```css
.summary-stats {
  display: flex;
  justify-content: space-around;
  padding: 20px;
  margin-top: 20px;
  border-top: 1px solid #e0e0e0;
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #40c463;
}

.stat-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Mobile: Stack vertically */
@media (max-width: 768px) {
  .summary-stats {
    flex-direction: column;
    align-items: stretch;
  }

  .stat-item {
    flex-direction: row;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;
  }

  .stat-item:last-child {
    border-bottom: none;
  }
}
```

---

## Loading & Error States

### Loading Skeletons

```tsx
function HeatmapSkeleton() {
  return (
    <div className="heatmap-skeleton">
      {Array.from({ length: 4 }, (_, weekIndex) => (
        <div key={weekIndex} className="skeleton-week">
          {Array.from({ length: 7 }, (_, dayIndex) => (
            <div key={dayIndex} className="skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="list-skeleton">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="skeleton-list-item">
          <div className="skeleton-text skeleton-date" />
          <div className="skeleton-text skeleton-count" />
        </div>
      ))}
    </div>
  );
}
```

### CSS for Skeletons

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.skeleton-cell,
.skeleton-text {
  background-color: #e0e0e0;
  animation: pulse 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.skeleton-cell {
  width: 12px;
  height: 12px;
}

.skeleton-date {
  width: 120px;
  height: 20px;
}

.skeleton-count {
  width: 60px;
  height: 16px;
}
```

### Error Handling

```tsx
function ErrorMessage({ error }: { error: ApolloError }) {
  const errorCode = error.graphQLErrors[0]?.extensions?.code;

  let message = "Failed to load progress data.";

  if (errorCode === "BAD_USER_INPUT") {
    message = error.message;
  } else if (errorCode === "DATABASE_ERROR") {
    message = "Database error. Please try again later.";
  }

  return (
    <div className="error-message">
      <span className="error-icon">⚠️</span>
      <p>{message}</p>
      <button onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );
}
```

---

## Recommended Libraries

### React Ecosystem
- **Apollo Client** or **urql**: GraphQL client
- **date-fns**: Date manipulation and formatting
- **react-tooltip**: Enhanced tooltips for heatmap cells
- **framer-motion**: Smooth animations for view transitions

### Optional: Pre-built Heatmap Components
- **react-calendar-heatmap**: GitHub-style heatmap
- **@nivo/calendar**: Customizable calendar heatmap
- **recharts**: If you want to add charts alongside heatmap

### Installation

```bash
# Core dependencies
npm install @apollo/client date-fns

# Optional: Heatmap library
npm install react-calendar-heatmap
npm install @types/react-calendar-heatmap -D

# Optional: Animations
npm install framer-motion
```

---

## Accessibility Considerations

### Keyboard Navigation
```tsx
function HeatmapCell({ date, count }: DailyProgress) {
  return (
    <div
      className="heatmap-cell"
      role="button"
      tabIndex={0}
      aria-label={`${format(new Date(date), 'MMMM d, yyyy')}: ${count} flashes`}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          // Handle click
        }
      }}
      // ... other props
    />
  );
}
```

### ARIA Labels
- Add `aria-label` to all interactive elements
- Use `role="button"` for clickable cells
- Provide screen reader text for color intensity

### Color Contrast
- Ensure text has minimum 4.5:1 contrast ratio
- Don't rely solely on color to convey information
- Add patterns/icons for colorblind users (optional)

---

## Performance Optimization

### Query Caching

```tsx
const { data, loading } = useQuery(PROGRESS_QUERY, {
  variables: { fid, days },
  fetchPolicy: 'cache-first', // Use cached data if available
  nextFetchPolicy: 'cache-and-network', // Update in background
});
```

### Memoization

```tsx
const processedData = useMemo(() => {
  return organizeIntoWeeks(data?.progress || []);
}, [data?.progress]);
```

### Debounce Time Range Changes

```tsx
import { useDebouncedValue } from './hooks';

const debouncedDays = useDebouncedValue(days, 300);

useQuery(PROGRESS_QUERY, {
  variables: { fid, days: debouncedDays },
});
```

---

## Testing Checklist

### Functionality
- [ ] Heatmap displays correct colors for different counts
- [ ] List view shows accurate counts and dates
- [ ] View toggle switches between modes smoothly
- [ ] Time range selector updates data correctly
- [ ] Summary stats calculate correctly
- [ ] Click on heatmap cell navigates to detail view
- [ ] Tooltips show on hover

### Edge Cases
- [ ] User with 0 flashes (all gray cells)
- [ ] User with very high daily counts (50+ flashes)
- [ ] Leap year dates (Feb 29)
- [ ] Today's date highlighted correctly
- [ ] Loading state displays properly
- [ ] Error states handled gracefully

### Responsive Design
- [ ] Mobile: Cells are appropriately sized
- [ ] Mobile: List view is scrollable
- [ ] Tablet: Layout adapts correctly
- [ ] Desktop: Full heatmap visible

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces content correctly
- [ ] Color contrast meets WCAG standards
- [ ] Focus indicators visible

---

## Example: Complete Integration

```tsx
// pages/progress.tsx
import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { ProgressHeatmap, ProgressListView, ViewToggle, SummaryStats } from '@/components/progress';

type ViewMode = 'heatmap' | 'list';

export default function ProgressPage({ userFid }: { userFid: number }) {
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [days, setDays] = useState<7 | 14 | 30>(7);

  return (
    <div className="progress-page">
      <header className="page-header">
        <h1>Your Progress</h1>
        <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
      </header>

      <div className="time-range-selector">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            className={days === d ? 'active' : ''}
            onClick={() => setDays(d as 7 | 14 | 30)}
          >
            {d} Days
          </button>
        ))}
      </div>

      <main className="progress-content">
        {viewMode === 'heatmap' ? (
          <ProgressHeatmap fid={userFid} days={days} />
        ) : (
          <ProgressListView fid={userFid} days={days} />
        )}
      </main>
    </div>
  );
}
```

---

## API Response Examples

### 7 Days (Varied Activity)
```json
{
  "data": {
    "progress": [
      { "date": "2025-10-24", "count": 0 },
      { "date": "2025-10-25", "count": 3 },
      { "date": "2025-10-26", "count": 0 },
      { "date": "2025-10-27", "count": 5 },
      { "date": "2025-10-28", "count": 1 },
      { "date": "2025-10-29", "count": 0 },
      { "date": "2025-10-30", "count": 2 }
    ]
  }
}
```

### 30 Days (New User)
```json
{
  "data": {
    "progress": [
      { "date": "2025-10-01", "count": 0 },
      { "date": "2025-10-02", "count": 0 },
      ...
      { "date": "2025-10-30", "count": 0 }
    ]
  }
}
```

### 30 Days (Active User)
```json
{
  "data": {
    "progress": [
      { "date": "2025-10-01", "count": 2 },
      { "date": "2025-10-02", "count": 5 },
      { "date": "2025-10-03", "count": 1 },
      ...
      { "date": "2025-10-30", "count": 3 }
    ]
  }
}
```

---

## Questions?

If you encounter any issues or need clarification:
1. Check error messages in browser console
2. Verify GraphQL query syntax in Apollo DevTools
3. Test API endpoint directly in GraphQL Playground (http://localhost:4000/graphql)
4. Reach out with specific error codes or behaviors

Happy building! 🚀
