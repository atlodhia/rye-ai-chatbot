// src/tools/searchAll.ts
import { searchAmazonProductsTool } from '@/tools/amazon';
import { searchShopifyProductsTool } from '@/tools/shopify';
import { findAllowedMerchantUrlsTool } from '@/tools/allowedMerchants';

export const searchAllSourcesTool = {
  description:
    'Search Paceline Shopify plus external allowed merchants (Amazon/Nike/Lulu/REI/Whoop/Therabody). Always returns merged results.',
  parameters: searchShopifyProductsTool.parameters, // expects { query, limit }
  execute: async function* (args: any) {
    const merged: any[] = [];

    // Shopify first
    try {
      for await (const part of searchShopifyProductsTool.execute(args)) {
        if (Array.isArray(part.products)) merged.push(...part.products);
      }
    } catch (e) {
      // swallow; we still want external fallback
    }

    // Amazon second
    try {
      for await (const part of searchAmazonProductsTool.execute(args)) {
        if (Array.isArray(part.products)) merged.push(...part.products);
      }
    } catch (e) {
      // swallow
    }

    // Other allowed merchants by URL discovery
    try {
      for await (const part of findAllowedMerchantUrlsTool.execute(args)) {
        if (Array.isArray(part.urls)) {
          merged.push(
            ...part.urls.map((url: string) => ({
              source: 'rye',
              name: 'External product',
              price: 'Varies',
              imageUrl: 'Image not available',
              url,
              reason: 'Supported external merchant.',
              merchantDomain: new URL(url).hostname,
            }))
          );
        }
      }
    } catch (e) {
      // swallow
    }

    yield {
      state: 'ready' as const,
      products: merged.slice(0, args?.limit ?? 6),
    };
  },
};