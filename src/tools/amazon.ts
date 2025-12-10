import { tool } from 'ai';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { ShoppingProduct } from '../lib/types';

export type UnifiedProduct = ShoppingProduct & {
  source: 'shopify' | 'rye';
  merchantDomain?: string;
};

function cleanText(t?: string) {
  return (t || '').replace(/\s+/g, ' ').trim();
}

export function cleanPrice(whole?: string, fraction?: string): string {
  const w = cleanText(whole).replace(/[^\d,]/g, '');
  const f = cleanText(fraction).replace(/[^\d]/g, '');
  if (!w) return 'Price not available';

  const cents = (f || '00').padEnd(2, '0').slice(0, 2);
  return `$${w}.${cents}`;
}

export function extractSearchResults(
  htmlContent: string,
  maxResults: number
): UnifiedProduct[] {
  const $ = cheerio.load(htmlContent);
  const products: UnifiedProduct[] = [];

  $('[data-component-type="s-search-result"]')
    .slice(0, maxResults)
    .each((_, container) => {
      try {
        const product: UnifiedProduct = {
          source: 'rye',
          merchantDomain: 'amazon.com',
          name: 'Product name not found',
          price: 'Price not available',
          imageUrl: 'Image not found',
          rating: 'Rating not available',
          url: 'URL not found',
        };

        // Name
        const nameElem = $(container).find('a h2 span').first();
        if (nameElem.length) {
          product.name = cleanText(nameElem.text());
        }

        // URL
        const urlElem = $(container).find('a').first();
        if (urlElem.length) {
          const href = urlElem.attr('href');
          if (href) {
            product.url = href.startsWith('/')
              ? `https://www.amazon.com${href}`
              : href;
          }
        }

        // Price (whole + fraction)
        const whole = $(container).find('.a-price-whole').first().text();
        const fraction = $(container).find('.a-price-fraction').first().text();
        const altPrice = $(container)
          .find('[data-a-color="price"] .a-offscreen')
          .first()
          .text();

        if (whole) {
          product.price = cleanPrice(whole, fraction);
        } else if (altPrice) {
          const m = altPrice.match(/\$([\d,]+)\.(\d{2})/);
          if (m) product.price = `$${m[1]}.${m[2]}`;
        }

        // Image
        const imgElem = $(container).find('img.s-image').first();
        const imgUrl = imgElem.attr('src');
        if (imgUrl) {
          product.imageUrl = imgUrl;
        }

        // Rating
        const ratingText = $(container).find('.a-icon-alt').first().text();
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
        if (ratingMatch) {
          product.rating = `${ratingMatch[1]} out of 5`;
        }

        products.push(product);
      } catch (error) {
        console.error('Error extracting product data:', error);
      }
    });

  return products;
}

export async function fetchAmazonPage(url: string): Promise<string> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
  }
  return response.text();
}

export const searchAmazonProductsTool = tool({
  description:
    'Search for products on Amazon and return structured product info',
  inputSchema: z.object({
    query: z.string().describe('Amazon search query'),
    maxResults: z.number().min(1).max(10).default(3),
  }),
  async *execute({ query, maxResults = 5 }) {
    yield { state: 'loading' as const };

    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    const htmlContent = await fetchAmazonPage(searchUrl);
    const products = extractSearchResults(htmlContent, maxResults);

    if (products.length === 0) {
      yield {
        state: 'ready' as const,
        products: [],
        message: `No products found for "${query}"`,
      };
      return;
    }

    yield {
      state: 'ready' as const,
      products,
      query,
      totalResults: products.length,
    };
  },
});