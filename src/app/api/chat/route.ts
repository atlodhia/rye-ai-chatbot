// src/app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  InferUITools,
  streamText,
  stepCountIs,
  UIDataTypes,
  UIMessage,
  tool,
} from 'ai';
import { z } from 'zod';

import { searchAmazonProductsTool } from '@/tools/amazon';
import { searchShopifyProductsTool } from '@/tools/shopify';
import { findAllowedMerchantUrlsTool } from '@/tools/allowedMerchants';

/**
 * ---------------- tools wrapper ----------------
 */

const searchAllSourcesTool = tool({
  description:
    'Search both Paceline Shopify store and allowed external merchants. Use this when the user asks for products without providing a URL.',
  inputSchema: z.object({
    query: z.string().min(1).describe('User search query'),
    limit: z.number().int().min(1).max(12).optional().describe('Max products'),
  }),
  execute: async ({ query, limit = 6 }) => {
    const merged: any[] = [];

    // 1) Shopify
    try {
      // @ts-ignore
      const shopifyIter = searchShopifyProductsTool.execute({ query, limit });
      if (shopifyIter && Symbol.asyncIterator in shopifyIter) {
        for await (const chunk of shopifyIter as any) {
          if (Array.isArray(chunk?.products)) merged.push(...chunk.products);
        }
      }
    } catch (e) {
      console.warn('[searchAllSources] Shopify failed:', e);
    }

    // 2) Amazon
    try {
      // @ts-ignore
      const amazonIter = searchAmazonProductsTool.execute({ query, limit });
      if (amazonIter && Symbol.asyncIterator in amazonIter) {
        for await (const chunk of amazonIter as any) {
          if (Array.isArray(chunk?.products)) merged.push(...chunk.products);
        }
      }
    } catch (e) {
      console.warn('[searchAllSources] Amazon failed:', e);
    }

    // 3) Other allowed merchants
    try {
      // @ts-ignore
      const urlsIter = findAllowedMerchantUrlsTool.execute({ query, limit });
      if (urlsIter && Symbol.asyncIterator in urlsIter) {
        for await (const chunk of urlsIter as any) {
          if (Array.isArray(chunk?.urls)) {
            merged.push(
              ...chunk.urls.map((u: any) => ({
                source: 'rye',
                name: u.title || u.name || 'Product',
                price: u.price || 'Varies',
                imageUrl: u.imageUrl || 'Image not available',
                url: u.url,
                merchantDomain: u.merchantDomain,
                reason: u.reason || 'Matches your search.',
              }))
            );
          }
        }
      }
    } catch (e) {
      console.warn('[searchAllSources] allowedMerchants failed:', e);
    }

    // De-dupe by URL
    const seen = new Set<string>();
    const deduped = merged.filter((p) => {
      const key = p?.url || p?.productUrl || '';
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      state: 'ready' as const,
      products: deduped.slice(0, limit),
    };
  },
});

const tools = {
  searchAllSources: searchAllSourcesTool,

  searchShopifyProducts: tool({
    description: searchShopifyProductsTool.description,
    inputSchema:
      (searchShopifyProductsTool as any).inputSchema ||
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(12).optional(),
      }),
    execute: async (args: any) => {
      try {
        const products: any[] = [];
        // @ts-ignore
        const iter = searchShopifyProductsTool.execute(args);
        if (iter && Symbol.asyncIterator in iter) {
          for await (const chunk of iter as any) {
            if (Array.isArray(chunk?.products)) products.push(...chunk.products);
          }
        }
        return { state: 'ready' as const, products };
      } catch (e: any) {
        return {
          state: 'ready' as const,
          products: [],
          error: String(e?.message || e),
        };
      }
    },
  }),

  searchAmazonProducts: tool({
    description: searchAmazonProductsTool.description,
    inputSchema:
      (searchAmazonProductsTool as any).inputSchema ||
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(12).optional(),
      }),
    execute: async (args: any) => {
      try {
        const products: any[] = [];
        // @ts-ignore
        const iter = searchAmazonProductsTool.execute(args);
        if (iter && Symbol.asyncIterator in iter) {
          for await (const chunk of iter as any) {
            if (Array.isArray(chunk?.products)) products.push(...chunk.products);
          }
        }
        return { state: 'ready' as const, products };
      } catch (e: any) {
        return {
          state: 'ready' as const,
          products: [],
          error: String(e?.message || e),
        };
      }
    },
  }),

  findAllowedMerchantUrls: tool({
    description: findAllowedMerchantUrlsTool.description,
    inputSchema:
      (findAllowedMerchantUrlsTool as any).inputSchema ||
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(12).optional(),
      }),
    execute: async (args: any) => {
      try {
        const urls: any[] = [];
        // @ts-ignore
        const iter = findAllowedMerchantUrlsTool.execute(args);
        if (iter && Symbol.asyncIterator in iter) {
          for await (const chunk of iter as any) {
            if (Array.isArray(chunk?.urls)) urls.push(...chunk.urls);
          }
        }
        return { state: 'ready' as const, urls };
      } catch (e: any) {
        return {
          state: 'ready' as const,
          urls: [],
          error: String(e?.message || e),
        };
      }
    },
  }),
};

export type UseChatToolsMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof tools>
>;

/**
 * ---------------- MOTD helpers ----------------
 */

type MotdPayload = {
  dayGreeting?: string;
  title?: string;
  summary?: string;
  sourceName?: string;
  sourceUrl?: string;
  dateISO?: string;

  // tolerate older naming
  greeting?: string;
  headline?: string;
  source?: string;
  url?: string;
};

/** Normalize MOTD to a consistent shape regardless of route naming. */
function normalizeMotd(raw: any): MotdPayload | null {
  if (!raw || typeof raw !== 'object') return null;

  const title = raw.title || raw.headline || raw.storyTitle;
  const summary = raw.summary || raw.storySummary || raw.description;
  const dayGreeting = raw.dayGreeting || raw.greeting;
  const sourceName = raw.sourceName || raw.source;
  const sourceUrl = raw.sourceUrl || raw.url;
  const dateISO = raw.dateISO;

  if (!title && !summary) return null;

  return {
    dayGreeting,
    title,
    summary,
    sourceName,
    sourceUrl,
    dateISO,
  };
}

function extractMotdFromMessages(msgs: any[]): MotdPayload | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const motd = normalizeMotd(m?.data?.motd);
    if (motd) return motd;
  }
  return null;
}

async function getMotdServerSide(): Promise<MotdPayload | null> {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE || '';
    const res = await fetch(`${base}/api/motd`, { cache: 'no-store' });
    if (!res.ok) return null;
    const raw = await res.json();
    return normalizeMotd(raw);
  } catch (e) {
    console.warn('[motd] server-side fetch failed', e);
    return null;
  }
}

function isMotdQuery(text: string) {
  return /(today['’]s story|today['’]s topic|motd|story of the day|give me the gist|apply to me|gear ideas|plan it)/i.test(
    text || ''
  );
}

/**
 * ---------------- intent routing ----------------
 */
type Intent = 'ADVICE' | 'PRODUCT_LINK' | 'SHOPPING' | 'OTHER';

function detectIntent(latestUserText: string): Intent {
  const text = (latestUserText || '').toLowerCase();

  const hasUrl = /(https?:\/\/[^\s]+)/i.test(text);
  if (hasUrl) return 'PRODUCT_LINK';

  const adviceCues =
    /(how do i|how should i|routine|plan|getting into|start|begin|training|tips|guide|what type of things|help me|suggest a program|choose|decide|compare)/i;

  const strongShoppingCues =
    /(buy|purchase|order|price|budget|under \$|under\s+\d+|deal|discount|link|show me products)/i;

  if (adviceCues.test(text) && !strongShoppingCues.test(text)) return 'ADVICE';

  const shoppingCues =
    /(best|recommend|top|vs\.?|compare|packs|shoes|belt|vest|watch|tracker|plate|backpack)/i;

  if (strongShoppingCues.test(text) || shoppingCues.test(text)) return 'SHOPPING';

  return 'OTHER';
}

/**
 * ---------------- system prompts ----------------
 */

const globalStyleRules = `
GLOBAL STYLE RULES (apply to all replies):
- Do NOT greet the user with day/weekday lines (e.g., "Happy Friday", "welcome back").
- Only reference the MOTD story if the user is asking about "today's story"/MOTD.
- If the user is choosing between many options, ask 1–3 clarifying questions before showing products.
- Be concise, friendly, and practical.
`;

const coachSystemPrompt = `
You are Paceline's assistant — friendly, coach-like, and shopping-capable.

The user is asking for high-level guidance, training help, routines, or general advice.

IMPORTANT - MOTD QUERIES:
- If the user is asking about "today's story" or the MOTD (Message of the Day), you MUST respond about that story.
- Use the MOTD context provided to answer their question directly.
- For "give me the gist" - provide a clear, concise summary of the key points from today's story.
- For "apply to me" - explain how the story's findings can be applied to their routine.
- For "plan it" - create a simple, actionable plan based on the story.
- Be conversational and helpful - don't just repeat the summary, add value.

Rules:
- Do NOT call any tools (unless the user explicitly asks for products/gear).
- Do NOT output a JSON products array (unless explicitly asking for products).
- Be conversational and helpful.
- Give structured guidance (steps, routines, pitfalls, how to start).
- Ask 1–2 follow-up questions if useful.
- If products might help, suggest categories and invite a supported product link.
${globalStyleRules}
`;

const shoppingSystemPrompt = `
You are Paceline’s assistant — friendly, coach-like, and shopping-capable.

------------------------------------------
ALLOWED EXTERNAL MERCHANT DOMAINS
ONLY these external merchants are allowed:
amazon.com, nike.com, lululemon.com, rei.com, whoop.com, therabody.com
------------------------------------------

URL MODE (VERY IMPORTANT):
- If the user includes a full product URL (starts with http/https):
  1) Do NOT call any search tools.
  2) Check the URL’s domain against the allowed list.
  3) If allowed:
     - Return a JSON array with EXACTLY ONE product using that PDP URL.
     - source MUST be "rye".
     - name: best guess from the URL slug if unknown.
     - price: "Varies" if unknown.
     - imageUrl: "Image not available" if unknown.
     - reason: one short sentence why it matches the user’s request.
  4) If NOT allowed:
     - Explain that the merchant isn't supported for checkout.
     - Suggest one or two allowed merchants or ask for a supported URL.

SEARCH MODE:
You can recommend products from TWO sources:
1) Paceline Shopify store (tool: searchShopifyProducts)
2) External merchants supported by Rye Universal Checkout:
   - Amazon listings (tool: searchAmazonProducts)
   - Other allowed merchants (tool: findAllowedMerchantUrls)

Selection rules:
- Prefer Shopify products if they match well.
- If Shopify results are weak or empty, broaden to allowed external merchants.
- Never recommend merchants outside the allowed list.
- If recommending an external product, ALWAYS include a full PDP URL.
- Return up to 6 products total unless the user asks for more.
- Label each product with source: "shopify" or source: "rye".
- Do not invent products. Use tools when not in URL MODE.

IMPORTANT SEARCH BEHAVIOR:
- If Shopify returns ANY products, you should STILL search Amazon and allowed merchants
  (unless the user explicitly says "only Paceline items").
- If one source returns empty, keep going to the next tool.

Response format (STRICT):
1) First output a JSON array ONLY in this exact shape:
[
  {
    "source": "shopify" | "rye",
    "name": "...",
    "price": "...",
    "imageUrl": "...",
    "url": "...",
    "reason": "one short sentence why this fits"
  }
]

2) Immediately after the JSON, output a short helpful paragraph answering the user’s intent.
${globalStyleRules}
`;

/**
 * ---------------- route ----------------
 */

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    console.warn('[chat route] failed to parse JSON body:', e);
  }

  const incomingMessages = Array.isArray(body?.messages) ? body.messages : [];

  if (!incomingMessages.length && typeof body?.text === 'string') {
    incomingMessages.push({ role: 'user', content: body.text });
  }
  if (!incomingMessages.length && typeof body?.message === 'string') {
    incomingMessages.push({ role: 'user', content: body.message });
  }

  const latestUser = [...incomingMessages]
    .reverse()
    .find((m: any) => m.role === 'user');

  const latestText =
    typeof latestUser?.content === 'string' ? latestUser.content : '';

  const intent = detectIntent(latestText);

  // ✅ Get MOTD from messages OR server-side fallback
  let motd = extractMotdFromMessages(incomingMessages);
  if (!motd) {
    motd = await getMotdServerSide();
  }

  // ✅ Always include story to model (so context isn't lost),
  // but STRICTLY gate usage by isMotdQuery(latestText).
  const motdBlock = motd
    ? `
MOTD CONTEXT (for your reference):
Title: ${motd.title || '—'}
Summary: ${motd.summary || '—'}
Source: ${motd.sourceName || '—'} ${motd.sourceUrl ? `(${motd.sourceUrl})` : ''}
Date: ${motd.dateISO || new Date().toISOString().slice(0, 10)}

CRITICAL USAGE RULES:
- The user’s “today’s story” refers to THIS story.
- If the user is asking about today’s story / MOTD (detected by the server), use it directly.
- If the user is NOT asking about today’s story, IGNORE this block and do NOT mention it.
- Do NOT ask “which story do you mean?” when the user is in MOTD flow.
`
    : '';

  let system =
    intent === 'ADVICE' ? coachSystemPrompt : shoppingSystemPrompt;

  // ✅ Tell the model whether this turn is MOTD-related.
  const isMotd = isMotdQuery(latestText);
  const motdGate = `
SERVER DETECTION:
- motdAvailable: ${motd ? 'true' : 'false'}
- userIsAskingAboutMotd: ${isMotd ? 'true' : 'false'}

CRITICAL INSTRUCTIONS:
${isMotd && motd 
  ? '- The user IS asking about today\'s story. You MUST respond using the MOTD context provided above.'
  : '- The user is NOT asking about today\'s story. Do NOT reference MOTD at all.'}
`;

  system = `${system}\n\n${motdGate}\n\n${motdBlock}`.trim();

  if (!incomingMessages.length) {
    console.warn('[chat route] no messages provided');
  }

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system,
    messages: convertToModelMessages(incomingMessages),
    stopWhen: stepCountIs(14),
    tools,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: incomingMessages,
  });
}