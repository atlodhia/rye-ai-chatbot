// src/app/api/motd/route.ts
export const runtime = 'nodejs';

import { fetchHealthNews } from '@/lib/healthNews';

// Simple in-memory cache (resets on server restart)
// In production, consider using Redis or a database for persistent caching
let cachedStory: {
  story: Awaited<ReturnType<typeof fetchHealthNews>>;
  date: string;
} | null = null;

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Fetches daily health & wellness news from science-backed sources.
 * Caches the story for the current day to avoid hitting RSS feeds on every request.
 */
export async function GET(request: Request) {
  try {
    // Add CORS headers for Shopify integration
    const origin = request.headers.get('origin');
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    };
    const now = new Date();

    // Capitalized weekday
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });

    // Example: "Friday, December 5"
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });

    // ✅ Single clean greeting (no duplicate date)
    const dayGreeting = `Happy ${weekday} (${dateStr}) — welcome back.`;

    // Check cache - use cached story if it's from today
    const today = getTodayDateString();
    if (cachedStory && cachedStory.date === today && cachedStory.story) {
      const story = cachedStory.story;
      return Response.json(
        {
          dayGreeting,
          title: story.title,
          summary: story.summary,
          sourceName: story.source,
          sourceUrl: story.link,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // Fetch new health story with timeout (non-blocking)
    // Try to fetch, but don't wait too long - use fallback if needed
    // Use a shorter timeout to ensure fast response for the website
    let story: Awaited<ReturnType<typeof fetchHealthNews>> | null = null;
    
    try {
      const fetchPromise = fetchHealthNews().catch((err) => {
        console.warn('[motd] Health news fetch failed:', err);
        return null;
      });

      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn('[motd] Health news fetch timed out, using fallback');
          resolve(null);
        }, 2000); // 2 second timeout - fail fast for website
      });

      story = await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
      console.warn('[motd] Error in health news fetch:', error);
      story = null;
    }

    // Cache the story for today (even if null, to avoid repeated failed attempts)
    if (story) {
      cachedStory = {
        story,
        date: today,
      };

      return Response.json(
        {
          dayGreeting,
          title: story.title,
          summary: story.summary,
          sourceName: story.source,
          sourceUrl: story.link,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // If no story found, cache null to avoid repeated attempts today
    cachedStory = {
      story: null,
      date: today,
    };

    // Fallback if no story found
    const fallbackTitle = 'New research links short walks to improved metabolic health';
    const fallbackSummary =
      'A new study suggests that adding short, easy walks throughout the day can meaningfully improve blood sugar control and overall metabolic health—especially for people with busy schedules.';
    const fallbackSource = 'Healthline';
    const fallbackUrl = 'https://www.healthline.com/health/exercise-fitness/walking-benefits';

    return Response.json(
      {
        dayGreeting,
        title: fallbackTitle,
        summary: fallbackSummary,
        sourceName: fallbackSource,
        sourceUrl: fallbackUrl,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    // Ultimate fallback - ensure we always return something
    console.error('[motd] Unexpected error:', error);
    const now = new Date();
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });
    const dayGreeting = `Happy ${weekday} (${dateStr}) — welcome back.`;

    const origin = request.headers.get('origin');
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    };

    return Response.json(
      {
        dayGreeting,
        title: 'New research links short walks to improved metabolic health',
        summary:
          'A new study suggests that adding short, easy walks throughout the day can meaningfully improve blood sugar control and overall metabolic health—especially for people with busy schedules.',
        sourceName: 'Healthline',
        sourceUrl: 'https://www.healthline.com/health/exercise-fitness/walking-benefits',
      },
      { status: 200, headers: corsHeaders }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
      'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    },
  });
}