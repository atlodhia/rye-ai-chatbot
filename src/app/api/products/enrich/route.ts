// src/app/api/products/enrich/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ---------------- helpers ----------------

function stripAmazonRef(path: string) {
  const refIndex = path.indexOf('/ref=');
  if (refIndex >= 0) return path.slice(0, refIndex);
  return path;
}

function slugToTitle(slug: string) {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function guessTitleFromUrl(urlStr: string) {
  try {
    const u = new URL(urlStr);
    let path = stripAmazonRef(u.pathname);

    const dpIdx = path.indexOf('/dp/');
    if (dpIdx > 0) path = path.slice(0, dpIdx);

    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || '';

    if (!last) return 'Product';

    if (/^[A-Z0-9]{8,12}$/i.test(last) && segments.length >= 2) {
      return slugToTitle(segments[segments.length - 2]);
    }

    return slugToTitle(last);
  } catch {
    return 'Product';
  }
}

function money(amountSubunits?: number | null, currencyCode = 'USD') {
  if (amountSubunits == null) return 'Varies';
  const v = (amountSubunits / 100).toFixed(2);
  return currencyCode === 'USD' ? `$${v}` : `${v} ${currencyCode}`;
}

async function safeJson(res: Response) {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    console.error('[enrich] Non-JSON response:', raw.slice(0, 800));
    throw new Error(
      `Non-JSON response (${res.status}): ${raw || res.statusText}`
    );
  }
}

// ---------------- GraphQL client ----------------

function buildAuthorizationHeader() {
  const key = process.env.RYE_GRAPHQL_API_KEY;
  if (!key) throw new Error('Missing RYE_GRAPHQL_API_KEY');

  const mode = (process.env.RYE_GRAPHQL_AUTH_MODE || 'basic').toLowerCase();
  if (mode === 'bearer') return `Bearer ${key}`;

  return `Basic ${key}`;
}

async function ryeGraphql<T = any>(query: string, variables: any) {
  const base =
    process.env.RYE_GRAPHQL_API_BASE?.replace(/\/$/, '') ||
    'https://staging.graphql.api.rye.com/v1/query';

  const authHeader = buildAuthorizationHeader();

  const res = await fetch(base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      ...(process.env.RYE_SHOPPER_IP
        ? { 'Rye-Shopper-IP': process.env.RYE_SHOPPER_IP }
        : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await safeJson(res);

  if (json?.errors?.length) {
    const msg = json.errors.map((e: any) => e.message).join(' | ');
    console.error('[enrich] GraphQL errors:', json.errors);
    throw new Error(msg);
  }

  if (!res.ok) {
    throw new Error(json?.error || `GraphQL error (${res.status})`);
  }

  return json.data as T;
}

// ---------------- Rye queries ----------------

async function requestProductByUrl(url: string) {
  // Clean Amazon URLs - remove query parameters AND ref paths that might confuse Rye
  let cleanUrl = url;
  if (url.includes('amazon.com')) {
    try {
      const u = new URL(url);
      let pathname = u.pathname;
      
      // Remove /ref=... from pathname
      const refIndex = pathname.indexOf('/ref=');
      if (refIndex > 0) {
        pathname = pathname.substring(0, refIndex);
      }
      
      // Ensure trailing slash
      if (!pathname.endsWith('/')) {
        pathname += '/';
      }
      
      cleanUrl = `${u.origin}${pathname}`;
      console.log('[enrich] Cleaned Amazon URL from:', url);
      console.log('[enrich] Cleaned Amazon URL to:', cleanUrl);
    } catch (e) {
      console.warn('[enrich] Failed to clean URL:', e);
    }
  }

  // Try a simpler mutation first that just gets basic product info
  const SIMPLE_QUERY = `
    mutation RequestProductByURL($input: RequestProductByURLInput!) {
      requestProductByURL(input: $input) {
        __typename
        product {
          __typename
          id
          title
          url
        }
      }
    }
  `;

  const host = new URL(cleanUrl).hostname.toLowerCase();
  const isAmazon = host.includes('amazon.') || host.includes('amzn.');
  const marketplace = isAmazon ? 'AMAZON' : 'SHOPIFY';
  
  console.log('[enrich] Requesting with marketplace:', marketplace, 'for URL:', cleanUrl);

  try {
    // First try the simple query to see if we can get a product ID
    const simpleData = await ryeGraphql<any>(SIMPLE_QUERY, { 
      input: { url: cleanUrl, marketplace } 
    });
    
    const productId = simpleData?.requestProductByURL?.product?.id;
    
    if (!productId) {
      console.log('[enrich] No product ID returned from requestProductByURL');
      return null;
    }

    console.log('[enrich] Got product ID:', productId, '- now fetching full details');

    // Now use productByID which should be more reliable
    const fullProduct = await productById(productId, marketplace);
    
    console.log('[enrich] Full product response:', JSON.stringify(fullProduct, null, 2).slice(0, 3000));
    
    return fullProduct;
  } catch (e) {
    console.error('[enrich] requestProductByUrl failed:', e);
    return null;
  }
}

async function productById(id: string, marketplace: string) {
  const QUERY = `
    query ProductByID($id: ID!, $marketplace: Marketplace!) {
      productByID(id: $id, marketplace: $marketplace) {
        __typename
        id
        marketplace
        title
        description
        images { url }
        price { displayValue currency }
        vendor
        variants {
          __typename
          id
          title
        }
      }
    }
  `;

  const data = await ryeGraphql<any>(QUERY, { id, marketplace });
  return data?.productByID ?? null;
}

function normalizeRyeProduct(raw: any) {
  if (!raw) return null;

  // Price can be either { displayValue, currency } or a simple string
  const priceObj = raw?.price;
  const priceStr = priceObj?.displayValue || String(priceObj || 'Varies');

  const images = (raw?.images || [])
    .map((i: any) => i?.url || i)
    .filter(Boolean);

  // Amazon variants are separate products, not selectable options
  // Shopify variants have selectable options
  const isAmazon = raw?.marketplace === 'AMAZON';
  
  const variants = (raw?.variants || []).map((v: any) => {
    const variantTitle = v.title || 'Default';
    
    // For Amazon: Each variant is a separate product (different ASIN)
    // For Shopify: Extract size/color from title or use as-is
    const options = [];
    
    if (!isAmazon) {
      // For Shopify, try to parse options from title
      // e.g., "Small / Blue" → [{name: "Size", value: "Small"}, {name: "Color", value: "Blue"}]
      const parts = variantTitle.split('/').map((p: string) => p.trim());
      if (parts.length > 1) {
        options.push({ name: 'Size', value: parts[0] });
        if (parts[1]) options.push({ name: 'Color', value: parts[1] });
      } else if (variantTitle !== 'Default') {
        options.push({ name: 'Option', value: variantTitle });
      }
    } else {
      // For Amazon, just show the variant title as-is
      // Users will need to click through to Amazon to select
      if (variantTitle !== 'Default') {
        options.push({ name: 'Variant', value: variantTitle });
      }
    }

    return {
      id: String(v.id || ''),
      title: variantTitle,
      available: true,
      price: priceStr, // Amazon variants don't have individual prices in the variants array
      currencyCode: priceObj?.currency || 'USD',
      options,
      isAmazonVariant: isAmazon,
    };
  });

  console.log('[enrich] Marketplace:', raw?.marketplace);
  console.log('[enrich] Raw Rye variants:', JSON.stringify(raw?.variants, null, 2));
  console.log('[enrich] Normalized variants:', JSON.stringify(variants, null, 2));

  return {
    brand: raw.brand || raw.vendor || '',
    title: raw.title || '',
    description: raw.description || '',
    images,
    price: priceStr,
    currencyCode: priceObj?.currency || 'USD',
    variants,
    marketplace: raw?.marketplace,
    highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
    sentiment: raw.sentiment || null,
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
    merchantDomain: raw.merchantDomain || undefined,
    reviewSummary: null,
    likes: [],
    dislikes: [],
    sentimentPct: null,
  };
}

// ---------------- HTML scrape fallback ----------------

function decodeHtml(txt: string) {
  return txt
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(txt: string) {
  return decodeHtml(txt.replace(/<[^>]*>/g, ' '));
}

function extractJsonLdBlocks(html: string) {
  const blocks: any[] = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const json = JSON.parse(m[1].trim());
      blocks.push(json);
    } catch {}
  }
  return blocks;
}

function extractReviewsFromJsonLd(blocks: any[]) {
  const reviews: any[] = [];

  function walk(node: any) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== 'object') return;

    if (node.review) {
      const r = node.review;
      if (Array.isArray(r)) r.forEach((x) => reviews.push(x));
      else reviews.push(r);
    }

    Object.values(node).forEach(walk);
  }

  blocks.forEach(walk);

  return reviews
    .map((r) => ({
      rating:
        r?.reviewRating?.ratingValue ||
        r?.reviewRating?.value ||
        r?.rating ||
        null,
      title: r?.name || r?.headline || '',
      text: r?.reviewBody || r?.description || r?.text || '',
    }))
    .filter((r) => r.text);
}

function extractHighlightsFromHtml(html: string) {
  const bullets: string[] = [];

  const featureSection =
    html.match(/<div[^>]+id="feature-bullets"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    '';

  if (featureSection) {
    const lis = featureSection.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    if (lis) {
      lis.forEach((li) => {
        const t = stripTags(li);
        if (t.length > 8 && t.length < 180) bullets.push(t);
      });
    }
  }

  const shopifyContainers = [
    /<div[^>]+class="[^"]*(product__description|product-description|rte|accordion)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  shopifyContainers.forEach((re) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const block = m[2] || '';
      const lis = block.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (lis) {
        lis.forEach((li) => {
          const t = stripTags(li);
          if (t.length > 8 && t.length < 180) bullets.push(t);
        });
      }
    }
  });

  const seen = new Set<string>();
  const deduped = bullets.filter((b) => {
    const k = b.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return deduped.slice(0, 6);
}

function extractAppReviewsFromHtml(html: string) {
  const reviews: string[] = [];

  const containers = [
    /data-review-content="([^"]+)"/gi,
    /class="[^"]*(loox-review|yotpo-review|jdgm-rev__body|spr-review-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  containers.forEach((re) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const txt = stripTags(m[m.length - 1] || m[1] || '');
      if (txt.length > 20) reviews.push(txt);
    }
  });

  return reviews.slice(0, 25);
}

async function scrapePdp(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PacelineBot/1.0; +https://paceline.fit)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    const html = await res.text();
    if (!res.ok || !html) return null;

    const jsonLd = extractJsonLdBlocks(html);
    const jsonLdReviews = extractReviewsFromJsonLd(jsonLd);
    const appTextReviews = extractAppReviewsFromHtml(html);
    const highlights = extractHighlightsFromHtml(html);

    return {
      reviews:
        jsonLdReviews.length
          ? jsonLdReviews
          : appTextReviews.map((t) => ({ rating: null, title: '', text: t })),
      highlights,
      htmlSnippet: html.slice(0, 5000),
    };
  } catch (e) {
    console.warn('[enrich] scrapePdp failed:', e);
    return null;
  }
}

// ---------------- OpenAI fallbacks ----------------

async function generateHighlightsIfMissing(enriched: any) {
  const enabled =
    process.env.HIGHLIGHTS_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_HIGHLIGHTS_ENABLED === 'true';

  if (!enabled) return enriched;

  const alreadyHave =
    Array.isArray(enriched.highlights) && enriched.highlights.length > 0;
  if (alreadyHave) return enriched;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return enriched;

  const baseText = [
    enriched.title,
    enriched.description,
    ...(enriched.reviews || [])
      .slice(0, 10)
      .map((r: any) => r?.text)
      .filter(Boolean),
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 6000);

  if (!baseText) return enriched;

  try {
    const prompt = `
You are writing concise product highlights for a shopping card.
Return ONLY a JSON array of 3-5 short bullets (strings).
No markdown, no extra text.

Text:
${baseText}
`.trim();

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    const json = await safeJson(r);
    const content = json?.choices?.[0]?.message?.content?.trim?.() || '';

    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {}

    if (Array.isArray(parsed)) {
      enriched.highlights = parsed.filter(Boolean).slice(0, 5);
    }

    return enriched;
  } catch (e) {
    console.warn('[enrich] highlights fallback failed:', e);
    return enriched;
  }
}

async function summarizeReviewsIfEnabled(enriched: any) {
  const enabled =
    process.env.REVIEWS_SUMMARY_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_REVIEWS_SUMMARY_ENABLED === 'true';

  const reviews: any[] = Array.isArray(enriched.reviews) ? enriched.reviews : [];
  if (!enabled || reviews.length === 0) return enriched;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return enriched;

    const textBlob = reviews
      .slice(0, 25)
      .map((r) => r?.text || r?.content || r?.body || '')
      .filter(Boolean)
      .join('\n\n---\n\n')
      .slice(0, 8000);

    if (!textBlob) return enriched;

    const prompt = `
You are summarizing product reviews.
Return JSON in this exact shape:
{
  "reviewSummary": "2-3 sentences",
  "likes": ["bullet", "bullet", "bullet"],
  "dislikes": ["bullet", "bullet", "bullet"],
  "sentimentPct": {"positive": 0-100, "neutral": 0-100, "negative": 0-100}
}
Only use the review text. Be concise and factual.

Reviews:
${textBlob}
`.trim();

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });

    const json = await safeJson(r);
    const content = json?.choices?.[0]?.message?.content?.trim?.() || '';

    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }

    if (parsed && typeof parsed === 'object') {
      enriched.reviewSummary = parsed.reviewSummary || null;
      enriched.likes = parsed.likes || [];
      enriched.dislikes = parsed.dislikes || [];
      enriched.sentimentPct = parsed.sentimentPct || null;
    }

    return enriched;
  } catch (e) {
    console.warn('[enrich] review summarizer failed:', e);
    return enriched;
  }
}

// ---------------- route ----------------

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing url' },
        { status: 400 }
      );
    }

    // 1) Rye enrich by URL
    let raw: any = null;
    try {
      raw = await requestProductByUrl(url);
    } catch (e) {
      console.warn('[enrich] requestProductByURL failed:', e);
      raw = null;
    }

    // 2) optional deeper Rye fetch (only if marketplace exists)
    if (raw?.id && raw?.marketplace) {
      try {
        const deeper = await productById(raw.id, raw.marketplace);
        if (deeper) raw = deeper;
      } catch (e) {
        console.warn('[enrich] productByID failed, using URL result:', e);
      }
    }

    const normalized = normalizeRyeProduct(raw);

    const enriched =
      normalized || {
        brand: '',
        title: guessTitleFromUrl(url),
        description: '',
        images: [],
        price: 'Varies',
        currencyCode: 'USD',
        variants: [],
        highlights: [],
        sentiment: null,
        reviews: [],
        reviewSummary: null,
        likes: [],
        dislikes: [],
        sentimentPct: null,
      };

    // 3) scrape fallback if Rye thin
    const needReviews = !enriched.reviews || enriched.reviews.length < 3;
    const needHighlights =
      !enriched.highlights || enriched.highlights.length === 0;

    if (needReviews || needHighlights) {
      const scraped = await scrapePdp(url);
      if (scraped) {
        if (needReviews && scraped.reviews?.length)
          enriched.reviews = scraped.reviews;
        if (needHighlights && scraped.highlights?.length)
          enriched.highlights = scraped.highlights;

        if (!enriched.description && scraped.htmlSnippet) {
          const metaDesc =
            scraped.htmlSnippet.match(
              /<meta[^>]+name="description"[^>]+content="([^"]+)"/i
            )?.[1] || '';
          if (metaDesc) enriched.description = decodeHtml(metaDesc);
        }
      }
    }

    // 4) OpenAI fallbacks
    const withHighlights = await generateHighlightsIfMissing(enriched);
    const withSummary = await summarizeReviewsIfEnabled(withHighlights);

    return NextResponse.json({ ok: true, enriched: withSummary });
  } catch (e: any) {
    console.error('[enrich] error:', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}