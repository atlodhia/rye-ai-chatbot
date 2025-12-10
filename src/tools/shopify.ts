import { tool } from "ai";
import { z } from "zod";
import { ShoppingProduct } from "@/lib/types";

export const searchShopifyProductsTool = tool({
  description: "Search Paceline’s Shopify store for products matching a query.",
  inputSchema: z.object({
    query: z.string().min(1).describe("What the user is shopping for"),
    maxResults: z.number().min(1).max(10).default(3).describe("How many products to return"),
  }),

  async *execute({ query, maxResults = 3 }) {
    yield { state: "loading" as const };

    // --- call Storefront API ---
    const url = process.env.SHOPIFY_STOREFRONT_URL!;
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN!;

    if (!url || !token) {
      yield {
        state: "ready" as const,
        products: [],
        error: "Missing SHOPIFY_STOREFRONT_URL or SHOPIFY_STOREFRONT_TOKEN",
      };
      return;
    }

    const gql = `
      query SearchProducts($query: String!, $first: Int!) {
        products(first: $first, query: $query) {
          edges {
            node {
              title
              onlineStoreUrl
              featuredImage { url }
              priceRange {
                minVariantPrice { amount currencyCode }
              }
            }
          }
        }
      }
    `;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({
        query: gql,
        variables: { query, first: maxResults },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      yield {
        state: "ready" as const,
        products: [],
        error: `Shopify error ${resp.status}: ${t}`,
      };
      return;
    }

    const json = await resp.json();

    const products: ShoppingProduct[] =
      json?.data?.products?.edges?.map((e: any) => ({
        name: e.node.title,
        price: `$${Number(e.node.priceRange.minVariantPrice.amount).toFixed(2)}`,
        imageUrl: e.node.featuredImage?.url ?? "Image not found",
        rating: "Rating not available",
        url: e.node.onlineStoreUrl ?? "URL not found",
      })) ?? [];

    yield {
      state: "ready" as const,
      products,
      query,
      totalResults: products.length,
    };
  },
});