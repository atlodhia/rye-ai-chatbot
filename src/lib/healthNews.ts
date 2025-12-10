/**
 * Health & Wellness News Fetcher
 * Fetches science-backed health news from RSS feeds
 */

import Parser from 'rss-parser';

const parser = new Parser();

// Health and wellness RSS feeds from science-backed sources
const NEWS_FEEDS = [
  'https://www.sciencedaily.com/rss/health_medicine.xml', // Science Daily - Health & Medicine
  'https://feeds.npr.org/1007/rss.xml', // NPR Health
  'https://feeds.bbci.co.uk/news/health/rss.xml', // BBC Health
];

// Keywords to filter for health/wellness/science content
const HEALTH_KEYWORDS = [
  'health',
  'wellness',
  'medical',
  'medicine',
  'study',
  'research',
  'scientific',
  'treatment',
  'therapy',
  'disease',
  'condition',
  'nutrition',
  'diet',
  'exercise',
  'fitness',
  'mental health',
  'cancer',
  'diabetes',
  'heart',
  'brain',
  'immune',
  'vitamin',
  'supplement',
  'sleep',
  'stress',
  'anxiety',
  'depression',
  'clinical',
  'trial',
  'patient',
  'doctor',
  'physician',
  'hospital',
  'healthcare',
  'wellbeing',
  'prevention',
  'diagnosis',
  'symptom',
  'syndrome',
  'disorder',
  'infection',
  'bacteria',
  'virus',
  'vaccine',
  'medication',
  'drug',
  'pharmaceutical',
  'biomedical',
  'epidemiology',
  'public health',
  'lifestyle',
  'aging',
  'longevity',
];

function isHealthRelated(text: string): boolean {
  if (!text) return false;
  const textLower = text.toLowerCase();
  // Check if at least 2 health keywords are present
  const keywordCount = HEALTH_KEYWORDS.filter((keyword) =>
    textLower.includes(keyword)
  ).length;
  return keywordCount >= 2;
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

        allStories.push({
          title,
          summary: truncatedSummary,
          link,
          published,
          source: feed.title || 'Health News',
        });

        // If we have enough stories, break early
        if (allStories.length >= 5) {
          break;
        }
      }

      // If we have enough stories from one feed, we can stop
      if (allStories.length >= 5) {
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

  // Select a random story from available ones
  const randomIndex = Math.floor(Math.random() * allStories.length);
  return allStories[randomIndex];
}
