// src/app/api/rotd/route.ts
export const runtime = 'nodejs';

import { fetchHealthyRecipes } from '@/lib/recipeNews';

// Simple in-memory cache (resets on server restart)
let cachedRecipe: {
  recipe: Awaited<ReturnType<typeof fetchHealthyRecipes>>;
  date: string;
} | null = null;

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Fetches daily healthy recipes from recipe sources.
 * Caches the recipe for the current day to avoid hitting RSS feeds on every request.
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

    // Check cache - use cached recipe if it's from today
    const today = getTodayDateString();
    if (cachedRecipe && cachedRecipe.date === today && cachedRecipe.recipe) {
      const recipe = cachedRecipe.recipe;
      return Response.json(
        {
          title: recipe.title,
          summary: recipe.summary,
          sourceName: recipe.source,
          sourceUrl: recipe.link,
          dateISO: today,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // Fetch new recipe with timeout (non-blocking)
    let recipe: Awaited<ReturnType<typeof fetchHealthyRecipes>> | null = null;
    
    try {
      const fetchPromise = fetchHealthyRecipes().catch((err) => {
        console.warn('[rotd] Recipe fetch failed:', err);
        return null;
      });

      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn('[rotd] Recipe fetch timed out, using fallback');
          resolve(null);
        }, 2000); // 2 second timeout - fail fast
      });

      recipe = await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
      console.warn('[rotd] Error in recipe fetch:', error);
      recipe = null;
    }

    // Cache the recipe for today (even if null, to avoid repeated failed attempts)
    if (recipe) {
      cachedRecipe = {
        recipe,
        date: today,
      };

      return Response.json(
        {
          title: recipe.title,
          summary: recipe.summary,
          sourceName: recipe.source,
          sourceUrl: recipe.link,
          dateISO: today,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // If no recipe found, cache null to avoid repeated attempts today
    cachedRecipe = {
      recipe: null,
      date: today,
    };

    // Fallback if no recipe found - use a healthy, protein-focused recipe
    const fallbackTitle = 'High-protein Greek yogurt berry bowl';
    const fallbackSummary =
      'Quick breakfast or snack: Greek yogurt + mixed berries + chia seeds + drizzle of honey. ~25g protein, high fiber, minimal prep. Perfect for post-workout or a healthy start to your day.';
    const fallbackSource = 'Paceline Kitchen';
    const fallbackUrl = 'https://paceline.fit/blog/high-protein-greek-yogurt-berry-bowl';

    return Response.json(
      {
        title: fallbackTitle,
        summary: fallbackSummary,
        sourceName: fallbackSource,
        sourceUrl: fallbackUrl,
        dateISO: today,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    // Ultimate fallback - ensure we always return something
    console.error('[rotd] Unexpected error:', error);
    const today = getTodayDateString();
    const origin = request.headers.get('origin');
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    };

    return Response.json(
      {
        title: 'High-protein Greek yogurt berry bowl',
        summary:
          'Quick breakfast or snack: Greek yogurt + mixed berries + chia seeds + drizzle of honey. ~25g protein, high fiber, minimal prep.',
        sourceName: 'Paceline Kitchen',
        sourceUrl: 'https://paceline.fit/blog/high-protein-greek-yogurt-berry-bowl',
        dateISO: today,
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