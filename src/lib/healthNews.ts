/**
 * Health & Wellness News Fetcher
 * Fetches science-backed health news from RSS feeds
 */

import Parser from 'rss-parser';

const parser = new Parser();

// Health and wellness RSS feeds from science-backed sources
const NEWS_FEEDS = [
  'https://feeds.npr.org/1007/rss.xml', // NPR Health - more accessible content
  'https://feeds.bbci.co.uk/news/health/rss.xml', // BBC Health
  'https://www.sciencedaily.com/rss/health_medicine.xml', // Science Daily - Health & Medicine (fallback)
];

// Keywords that indicate fitness, nutrition, and consumer health content (prioritized for product sales)
const FITNESS_NUTRITION_KEYWORDS = [
  // Fitness & Exercise
  'fitness',
  'exercise',
  'workout',
  'training',
  'running',
  'walking',
  'cycling',
  'strength',
  'cardio',
  'yoga',
  'pilates',
  'gym',
  'equipment',
  'gear',
  'apparel',
  'shoes',
  'sneakers',
  'athletic',
  'sports',
  'activity tracker',
  'fitness tracker',
  'heart rate',
  'steps',
  'calories',
  'burn',
  'muscle',
  'recovery',
  'stretching',
  'mobility',
  
  // Nutrition & Supplements
  'nutrition',
  'diet',
  'protein',
  'supplement',
  'vitamin',
  'mineral',
  'meal',
  'food',
  'eating',
  'calorie',
  'macro',
  'carb',
  'fat',
  'fiber',
  'hydration',
  'water',
  'smoothie',
  'snack',
  'healthy eating',
  'meal plan',
  'nutrition plan',
  
  // Consumer Health Products
  'wearable',
  'device',
  'monitor',
  'scale',
  'blood pressure',
  'sleep tracker',
  'smartwatch',
  'fitness band',
  'resistance band',
  'dumbbell',
  'kettlebell',
  'mat',
  'foam roller',
  'massage',
  'recovery tool',
  
  // Actionable phrases
  'study finds',
  'research shows',
  'can help',
  'may improve',
  'linked to',
  'benefits',
  'improves',
  'reduces',
];

// Keywords to filter for health/wellness content (broader set, but still product-focused)
const HEALTH_KEYWORDS = [
  'health',
  'wellness',
  'fitness',
  'exercise',
  'nutrition',
  'diet',
  'supplement',
  'vitamin',
  'sleep',
  'stress',
  'recovery',
  'performance',
  'energy',
  'metabolism',
  'weight',
  'muscle',
  'strength',
  'endurance',
  'lifestyle',
  'wellbeing',
];

function isHealthRelated(text: string): boolean {
  if (!text) return false;
  const textLower = text.toLowerCase();
  
  // STRICT filtering: Must have fitness/nutrition/consumer health keywords
  // Require at least 2 fitness/nutrition keywords to ensure relevance
  const fitnessNutritionCount = FITNESS_NUTRITION_KEYWORDS.filter((keyword) =>
    textLower.includes(keyword)
  ).length;
  
  // Also check for general health keywords, but require more
  const healthKeywordCount = HEALTH_KEYWORDS.filter((keyword) =>
    textLower.includes(keyword)
  ).length;
  
  // STRICT: Require at least 2 fitness/nutrition keywords OR 3+ health keywords
  // This ensures we only get stories that are clearly about fitness/nutrition/consumer health
  const isRelevant = fitnessNutritionCount >= 2 || healthKeywordCount >= 3;
  
  // Exclude niche medical conditions and diseases
  const excludeMedicalTerms = [
    'archaeology', 'ancient', 'prehistoric', 'fossil', 'cave', 'stone age', 
    'paleolithic', 'neolithic', 'evolution of', 'history of', 'anthropology',
    'tumor', 'cancer', 'tumor', 'brain tumor', 'cancer treatment', 'chemotherapy',
    'radiation', 'oncology', 'malignant', 'benign tumor', 'metastasis',
    'diabetes type', 'type 1 diabetes', 'type 2 diabetes', 'insulin resistance',
    'heart disease', 'heart attack', 'stroke', 'cardiovascular disease',
    'alzheimer', 'dementia', 'parkinson', 'multiple sclerosis', 'epilepsy',
    'autism', 'adhd', 'bipolar', 'schizophrenia', 'depression treatment',
    'anxiety disorder', 'ptsd', 'ocd', 'eating disorder',
    'covid', 'coronavirus', 'pandemic', 'vaccine', 'immunization',
    'surgery', 'operation', 'medical procedure', 'clinical trial',
    'rare disease', 'genetic disorder', 'syndrome', 'chronic illness',
    'kidney disease', 'liver disease', 'lung disease', 'respiratory disease',
    'arthritis', 'osteoporosis', 'fibromyalgia', 'lupus', 'crohn',
    'ibd', 'celiac', 'gluten intolerance', 'allergy treatment',
    'hiv', 'aids', 'hepatitis', 'tuberculosis', 'malaria',
    'pregnancy', 'maternal', 'prenatal', 'postpartum',
    'pediatric', 'children\'s disease', 'childhood cancer',
    'elderly care', 'nursing home', 'hospice',
  ];
  const hasExcludeTerms = excludeMedicalTerms.some(term => textLower.includes(term));
  
  return isRelevant && !hasExcludeTerms;
}

function scoreStoryRelevance(story: HealthStory): number {
  const textLower = `${story.title} ${story.summary}`.toLowerCase();
  
  // Higher score for fitness/nutrition/consumer health keywords (product-sellable topics)
  const fitnessNutritionScore = FITNESS_NUTRITION_KEYWORDS.filter((keyword) =>
    textLower.includes(keyword)
  ).length * 4;
  
  // Lower score for overly scientific/research-heavy terms (we want to deprioritize these)
  const scientificTerms = ['molecular', 'genetic', 'cellular', 'pathway', 'mechanism', 'biomarker', 'pharmaceutical', 'clinical trial phase', 'cancer treatment', 'disease treatment', 'medical procedure', 'tumor', 'oncology', 'malignant'];
  const scientificScore = scientificTerms.filter((term) =>
    textLower.includes(term)
  ).length * -5;
  
  // Lower score for medical/clinical topics that don't relate to consumer products
  const medicalTerms = ['hospital', 'surgery', 'diagnosis', 'treatment', 'medication', 'prescription', 'doctor visit', 'clinical', 'disease', 'disorder', 'syndrome', 'condition', 'illness'];
  const medicalScore = medicalTerms.filter((term) =>
    textLower.includes(term)
  ).length * -3;
  
  // Heavily penalize niche medical conditions
  const nicheMedicalTerms = ['brain tumor', 'cancer', 'diabetes', 'heart disease', 'alzheimer', 'parkinson', 'autism', 'adhd', 'rare disease', 'genetic disorder'];
  const nicheMedicalScore = nicheMedicalTerms.filter((term) =>
    textLower.includes(term)
  ).length * -10;
  
  // Bonus for product-related terms
  const productTerms = ['equipment', 'gear', 'device', 'tracker', 'supplement', 'apparel', 'shoes', 'wearable', 'tool'];
  const productScore = productTerms.filter((term) =>
    textLower.includes(term)
  ).length * 5;
  
  // Bonus for common actionable phrases
  const actionablePhrases = ['study finds', 'research shows', 'study suggests', 'can help', 'may improve', 'linked to', 'benefits'];
  const phraseScore = actionablePhrases.filter((phrase) =>
    textLower.includes(phrase)
  ).length * 2;
  
  return fitnessNutritionScore + scientificScore + medicalScore + nicheMedicalScore + productScore + phraseScore;
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

export interface HealthStory {
  title: string;
  summary: string;
  link: string;
  published?: string;
  source: string;
}

export async function fetchHealthNews(): Promise<HealthStory | null> {
  const allStories: HealthStory[] = [];

  // Try each feed with individual timeouts
  for (const feedUrl of NEWS_FEEDS) {
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

        // Filter for health/wellness/science content
        const combinedText = `${title} ${summary}`.toLowerCase();
        if (!isHealthRelated(combinedText)) {
          continue; // Skip non-health stories
        }

        // Limit summary length
        const truncatedSummary =
          summary.length > 300 ? summary.substring(0, 297) + '...' : summary;

        const story: HealthStory = {
          title,
          summary: truncatedSummary,
          link,
          published,
          source: feed.title || 'Health News',
        };

        allStories.push(story);

        // If we have enough stories, break early
        if (allStories.length >= 10) {
          break;
        }
      }

      // If we have enough stories from one feed, we can stop
      if (allStories.length >= 10) {
        break;
      }
    } catch (error) {
      console.warn(`[healthNews] Error fetching from ${feedUrl}:`, error);
      continue;
    }
  }

  if (allStories.length === 0) {
    return null;
  }

  // Score and sort stories by relevance (prioritize actionable content)
  const scoredStories = allStories.map((story) => ({
    story,
    score: scoreStoryRelevance(story),
  }));

  // Sort by score (highest first)
  scoredStories.sort((a, b) => b.score - a.score);

  // Prefer top-scored stories, but add some randomness to top 3
  const topStories = scoredStories.slice(0, 3);
  const selected = topStories[Math.floor(Math.random() * topStories.length)];
  
  return selected.story;
}
