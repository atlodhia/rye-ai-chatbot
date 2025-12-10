# MOTD Health News Integration

The MOTD (Message of the Day) API route has been updated to fetch real health & wellness news from science-backed sources.

## What Changed

1. **New Library**: `src/lib/healthNews.ts`
   - Fetches health news from RSS feeds (Science Daily, NPR Health, BBC Health)
   - Filters stories to ensure they're health/wellness related
   - Uses keyword matching to validate content

2. **Updated Route**: `src/app/api/motd/route.ts`
   - Now fetches real health news instead of static content
   - Implements daily caching (story cached for the current day)
   - Falls back to default story if fetching fails

## How It Works

1. On first request of the day, the API fetches health news from RSS feeds
2. Stories are filtered to ensure they're health/wellness related (using keyword matching)
3. A random story is selected from available health stories
4. The story is cached in memory for the rest of the day
5. Subsequent requests return the cached story (no RSS hits)

## News Sources

- **Science Daily** (Health & Medicine)
- **NPR Health**
- **BBC Health**

All sources are science-backed and reputable.

## Caching

- Stories are cached per day (resets at midnight)
- Cache is in-memory (resets on server restart)
- For production, consider Redis or database for persistent caching

## Testing

To test the integration:

```bash
# Start the dev server
npm run dev

# In another terminal, test the API
curl http://localhost:3000/api/motd
```

The response will include:
- `dayGreeting`: Formatted greeting with day/date
- `title`: Health news story title
- `summary`: Story summary
- `sourceName`: News source name
- `sourceUrl`: Link to full article

## Fallback

If no health stories are found or RSS feeds fail, the API returns a fallback story about walking and metabolic health.
