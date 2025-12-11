/**
 * Healthy Recipe Fetcher
 * Fetches healthy recipes from RSS feeds
 */

import Parser from 'rss-parser';

const parser = new Parser();

// Healthy recipe RSS feeds
const RECIPE_FEEDS = [
  'https://www.eatingwell.com/rss/recipes/', // Eating Well - healthy recipes
  'https://www.healthline.com/nutrition/rss', // Healthline Nutrition
  'https://www.cookinglight.com/rss/recipes/', // Cooking Light
];

// Keywords that indicate healthy, fitness-focused recipes (prioritized)
const HEALTHY_RECIPE_KEYWORDS = [
  // Protein-focused
  'protein',
  'high protein',
  'lean protein',
  'chicken',
  'turkey',
  'fish',
  'salmon',
  'tuna',
  'eggs',
  'greek yogurt',
  'cottage cheese',
  'tofu',
  'tempeh',
  'beans',
  'lentils',
  
  // Healthy carbs
  'quinoa',
  'brown rice',
  'sweet potato',
  'oatmeal',
  'oats',
  'whole grain',
  'whole wheat',
  
  // Vegetables
  'vegetable',
  'salad',
  'greens',
  'broccoli',
  'spinach',
  'kale',
  'asparagus',
  'zucchini',
  
  // Healthy fats
  'avocado',
  'nuts',
  'almonds',
  'walnuts',
  'olive oil',
  
  // Meal types
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'smoothie',
  'bowl',
  'salad',
  
  // Health descriptors
  'healthy',
  'nutritious',
  'low calorie',
  'low carb',
  'high fiber',
  'gluten free',
  'dairy free',
  'vegan',
  'vegetarian',
  'paleo',
  'keto',
  'mediterranean',
  
  // Cooking methods
  'grilled',
  'baked',
  'roasted',
  'steamed',
  'stir fry',
];

// Keywords to filter for recipe content
const RECIPE_KEYWORDS = [
  'recipe',
  'cooking',
  'meal',
  'dish',
  'food',
  'ingredient',
  'nutrition',
  'calorie',
  'protein',
  'carb',
  'fiber',
  'healthy',
  'diet',
];

function isRecipeRelated(text: string): boolean {
  if (!text) return false;
  const textLower = text.toLowerCase();
  
  // Must have recipe keywords
  const recipeKeywordCount = RECIPE_KEYWORDS.filter((keyword) =>
    textLower.includes(keyword)
  ).length;
  
  if (recipeKeywordCount < 1) return false;
  
  // Prefer healthy recipe keywords
  const healthyKeywordCount = HEALTHY_RECIPE_KEYWORDS.filter((keyword) =>
    textLower.includes(keyword)
  ).length;
  
  // Require at least 1 healthy keyword OR multiple recipe keywords
  return healthyKeywordCount >= 1 || recipeKeywordCount >= 2;
}

function scoreRecipeRelevance(recipe: RecipeStory): number {
  const textLower = `${recipe.title} ${recipe.summary}`.toLowerCase();
  
  // Higher score for healthy recipe keywords
  const healthyScore = HEALTHY_RECIPE_KEYWORDS.filter((keyword) =>
    textLower.includes(keyword)
  ).length * 4;
  
  // Lower score for unhealthy/unfit recipes
  const unhealthyTerms = ['fried', 'deep fried', 'butter', 'cream', 'sugar', 'dessert', 'cake', 'cookie', 'pie', 'candy', 'soda', 'processed'];
  const unhealthyScore = unhealthyTerms.filter((term) =>
    textLower.includes(term)
  ).length * -3;
  
  // Bonus for protein-focused recipes
  const proteinTerms = ['high protein', 'protein', 'lean', 'chicken', 'turkey', 'fish', 'salmon', 'eggs', 'greek yogurt'];
  const proteinScore = proteinTerms.filter((term) =>
    textLower.includes(term)
  ).length * 5;
  
  // Bonus for quick/easy recipes
  const quickTerms = ['quick', 'easy', 'simple', 'fast', '15 minute', '30 minute', 'one pot', 'sheet pan'];
  const quickScore = quickTerms.filter((term) =>
    textLower.includes(term)
  ).length * 2;
  
  return healthyScore + unhealthyScore + proteinScore + quickScore;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export interface RecipeStory {
  title: string;
  summary: string;
  link: string;
  published?: string;
  source: string;
}

export async function fetchHealthyRecipes(): Promise<RecipeStory | null> {
  const allRecipes: RecipeStory[] = [];

  // Try each feed with individual timeouts
  for (const feedUrl of RECIPE_FEEDS) {
    try {
      // Add timeout per feed (2 seconds - fail fast)
      const feedPromise = parser.parseURL(feedUrl);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 2000);
      });

      const feed = await Promise.race([feedPromise, timeoutPromise]);

      // Limit to first 10 items per feed to avoid processing too many
      const itemsToProcess = feed.items.slice(0, 10);

      for (const item of itemsToProcess) {
        const title = item.title || '';
        const summary = cleanHtml(item.contentSnippet || item.content || item.description || '');
        const link = item.link || '';
        const published = item.pubDate || item.isoDate || '';

        // Skip if missing essential data
        if (!title || !link) {
          continue;
        }

        // Filter for recipe content
        const combinedText = `${title} ${summary}`.toLowerCase();
        if (!isRecipeRelated(combinedText)) {
          continue; // Skip non-recipe stories
        }

        // Limit summary length
        const truncatedSummary =
          summary.length > 300 ? summary.substring(0, 297) + '...' : summary;

        const recipe: RecipeStory = {
          title,
          summary: truncatedSummary,
          link,
          published,
          source: feed.title || 'Recipe Source',
        };

        allRecipes.push(recipe);

        // If we have enough recipes, break early
        if (allRecipes.length >= 10) {
          break;
        }
      }

      // If we have enough recipes from one feed, we can stop
      if (allRecipes.length >= 10) {
        break;
      }
    } catch (error) {
      console.warn(`[recipeNews] Error fetching from ${feedUrl}:`, error);
      continue;
    }
  }

  if (allRecipes.length === 0) {
    return null;
  }

  // Score and sort recipes by relevance (prioritize healthy, protein-focused recipes)
  const scoredRecipes = allRecipes.map((recipe) => ({
    recipe,
    score: scoreRecipeRelevance(recipe),
  }));

  // Sort by score (highest first)
  scoredRecipes.sort((a, b) => b.score - a.score);

  // Prefer top-scored recipes, but add some randomness to top 3
  const topRecipes = scoredRecipes.slice(0, 3);
  const selected = topRecipes[Math.floor(Math.random() * topRecipes.length)];
  
  return selected.recipe;
}

