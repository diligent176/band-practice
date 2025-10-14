# Import Speed Analysis and Solutions

## Why Import is Slow

The import process is slow because **each song fetches lyrics from Genius**, which involves:

1. **Genius API Search** (~1-2 seconds per song)

   - Searches for the song by title/artist
   - Gets the Genius page URL

2. **Web Scraping** (~3-5 seconds per song)

   - Downloads the Genius lyrics page (timeout set to 5 seconds)
   - Parses HTML with BeautifulSoup
   - Extracts and formats lyrics

3. **Sequential Processing** (not parallel)
   - Songs are processed one at a time
   - Total time: 6 songs × 5-7 seconds = **30-42 seconds**

## Current Improvements Applied

### 1. Reduced Timeout ✅

Changed lyrics scraping timeout from **10 seconds → 5 seconds**

- Faster failure on unreachable pages
- Still enough time for most requests

### 2. Added Debug Logging ✅

Added console output:

```
🎵 Fetching lyrics for Artist - Title...
✅ Got lyrics for Artist - Title
```

Check your Flask terminal to see progress in real-time.

## Why It Shows "Waiting..."

The UI shows "Waiting..." because:

1. Backend is fetching lyrics (slow external API calls)
2. No progress update is sent until lyrics are fetched
3. Then status changes to "Success" or "Failed"

This is by design - each song completes fully before moving to the next.

## Further Optimization Options

### Option 1: Make Lyrics Optional (Fastest)

Import songs **without lyrics** first, fetch lyrics in background:

**Benefits:**

- ⚡ Import completes in ~5 seconds
- Songs appear immediately
- Lyrics load in background when you view each song
- Much better UX

**Implementation:**

- Skip `_fetch_lyrics()` during import
- Set `lyrics: "Loading..."`
- Fetch lyrics when song is first viewed

### Option 2: Parallel Processing (Medium Speed)

Use Python's `concurrent.futures` to fetch multiple songs at once:

**Benefits:**

- ~3x faster (process 3 songs at once)
- Still gets all lyrics during import

**Drawbacks:**

- More complex code
- May hit Genius rate limits
- Progress reporting is trickier

### Option 3: Use ScraperAPI (Medium Speed)

You have ScraperAPI in the code but it's not configured:

**Benefits:**

- Faster, more reliable scraping
- Bypasses rate limits
- Handles retries automatically

**Setup:**

1. Sign up at scraperapi.com (1000 free requests/month)
2. Add `SCRAPER_API_KEY` to your `.env` file
3. Lyrics fetching becomes more reliable

### Option 4: Cache Lyrics (Smart)

Cache fetched lyrics in a separate collection:

**Benefits:**

- First import is slow
- Subsequent imports of same song are instant
- Share lyrics across users/collections

**Implementation:**

- Create `lyrics_cache` collection in Firestore
- Key: `artist__title`
- Value: lyrics data
- Check cache before scraping

## Recommended Approach

**Best Solution: Option 1 (Make Lyrics Optional)**

Change import to:

1. ⚡ Import song metadata instantly (artist, title, album, year, album art)
2. 📝 Set lyrics to "Loading..." or empty
3. 🎵 When user opens a song, fetch lyrics then (if not already fetched)
4. 💾 Cache lyrics in song document for future views

This gives you:

- **Instant imports** (5 seconds instead of 40 seconds)
- **Better UX** (songs appear immediately)
- **Lazy loading** (fetch what you need, when you need it)
- **Same end result** (all songs eventually have lyrics)

## Current Performance

With current implementation:

- **6 songs**: ~30-40 seconds
- **20 songs**: ~2-3 minutes
- **50 songs**: ~5-7 minutes

With lyrics optional:

- **Any number of songs**: ~5-10 seconds
- Lyrics load on-demand per song

## Implementation Steps (If You Want Option 1)

Would you like me to:

1. Make lyrics optional during import?
2. Add lazy lyrics loading when song is opened?
3. Show a "Fetch Lyrics" button per song?

This would dramatically improve the import experience!

## Check Progress Now

Look at your Flask terminal (where you ran `flask run`) - you should see:

```
🎵 Fetching lyrics for No Doubt - Underneath It All...
✅ Got lyrics for No Doubt - Underneath It All
🎵 Fetching lyrics for Morgan Wallen - I'm The Problem...
```

This will show you exactly which song is being processed and when.
