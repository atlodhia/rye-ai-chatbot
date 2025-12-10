// src/components/CheckoutModal.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ShoppingProduct, Buyer, CheckoutIntent } from '@/lib/types';

import {
  BasisTheoryProvider,
  CardElement,
  useBasisTheory,
} from '@basis-theory/react-elements';
import type { ICardElement } from '@basis-theory/react-elements';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderComplete: (
    product: ShoppingProduct,
    checkoutIntent: CheckoutIntent
  ) => void;
  product: ShoppingProduct;
}

type Variant = {
  id: string;
  title: string;
  options: Array<{ name: string; value: string }>;
  available: boolean;
  price?: string;
  currencyCode?: string;
};

type Enriched = {
  brand?: string;
  title: string;
  description?: string;
  images: string[];
  price: string;
  currencyCode?: string;
  variants: Variant[];
  highlights: string[];
  sentiment: null | { positive?: number; negative?: number; neutral?: number };
  reviews: any[];

  reviewSummary?: string | null;
  likes?: string[];
  dislikes?: string[];
  sentimentPct?: null | {
    positive?: number;
    neutral?: number;
    negative?: number;
  };
};

// ---------- image helpers ----------
function upgradeImageUrl(url?: string) {
  if (!url) return url;
  if (url.includes('m.media-amazon.com') || url.includes('amazon.com')) {
    let u = url;
    u = u.replace(/_AC_(UY|UX|UL|SY|SX)\d+_/g, '_AC_UL800_');
    u = u.replace(/_SL\d+_/g, '_SL1200_');
    u = u.replace(/_SX\d+_/g, '_SX1200_');
    u = u.replace(/_SY\d+_/g, '_SY1200_');
    return u;
  }
  if (url.includes('cdn.shopify.com')) {
    try {
      const u = new URL(url);
      if (!u.searchParams.get('width')) u.searchParams.set('width', '1200');
      return u.toString();
    } catch {
      return url;
    }
  }
  return url;
}

function isValidImageSrc(src?: string) {
  if (!src) return false;
  if (src === 'Image not found' || src === 'Image not available') return false;
  return /^https?:\/\//i.test(src) || src.startsWith('/');
}

// ---------- variant normalization ----------
function normalizeOptions(v: any): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];

  if (Array.isArray(v?.selectedOptions)) {
    v.selectedOptions.forEach((o: any) => {
      if (o?.name && o?.value) out.push({ name: o.name, value: o.value });
    });
  }

  if (Array.isArray(v?.options)) {
    v.options.forEach((o: any) => {
      if (o?.name && o?.value) out.push({ name: o.name, value: o.value });
    });
  }

  if (v?.option1) out.push({ name: 'Option 1', value: String(v.option1) });
  if (v?.option2) out.push({ name: 'Option 2', value: String(v.option2) });
  if (v?.option3) out.push({ name: 'Option 3', value: String(v.option3) });

  if (v?.attributes && typeof v.attributes === 'object') {
    Object.entries(v.attributes).forEach(([k, val]) => {
      if (val != null) out.push({ name: k, value: String(val) });
    });
  }

  if (!out.length && typeof v?.title === 'string' && v.title.includes(' / ')) {
    v.title.split(' / ').forEach((part: string, i: number) => {
      out.push({ name: `Option ${i + 1}`, value: part.trim() });
    });
  }

  const seen = new Set<string>();
  return out.filter((o) => {
    const k = `${o.name}:${o.value}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function normalizeEnrich(raw: any): Enriched | null {
  if (!raw) return null;
  const p = raw.enriched || raw.product || raw.data || raw;

  const title =
    p.title ||
    p.name ||
    p.productTitle ||
    p.product?.title ||
    '';

  const brand =
    p.brand ||
    p.vendor ||
    p.productBrand ||
    p.product?.vendor ||
    '';

  const images =
    (p.images || p.imageUrls || p.product?.images || [])
      .map((i: any) => (typeof i === 'string' ? i : i?.url))
      .filter(Boolean)
      .map((u: string) => upgradeImageUrl(u));

  let price = p.price;
  if (!price && p.price?.amountSubunits != null) {
    price = `$${(p.price.amountSubunits / 100).toFixed(2)}`;
  }
  if (typeof price === 'number') price = `$${price.toFixed(2)}`;
  if (typeof price !== 'string') price = '';

  const variants: Variant[] =
    (p.variants || p.product?.variants || [])
      .map((v: any) => ({
        id: String(v.id || v.variantId || v.sku || ''),
        title: v.title || v.name || 'Variant',
        options: normalizeOptions(v),
        available: v.available ?? v.inStock ?? true,
        price:
          v.price?.amountSubunits != null
            ? `$${(v.price.amountSubunits / 100).toFixed(2)}`
            : v.price || undefined,
        currencyCode: v.currencyCode || v.price?.currencyCode,
      }))
      .filter((v: Variant) => v.id || v.options.length || v.title);

  return {
    brand,
    title,
    description: p.description || p.product?.description || '',
    images,
    price,
    currencyCode: p.currencyCode || p.price?.currencyCode,
    variants,
    highlights: Array.isArray(p.highlights) ? p.highlights : [],
    sentiment: p.sentiment || null,
    reviews: Array.isArray(p.reviews) ? p.reviews : [],

    reviewSummary: p.reviewSummary ?? null,
    likes: Array.isArray(p.likes) ? p.likes : [],
    dislikes: Array.isArray(p.dislikes) ? p.dislikes : [],
    sentimentPct: p.sentimentPct ?? null,
  };
}

/** Shopify fallback variants */
function normalizeShopifyVariants(product: any): Variant[] {
  const vs = product?.variants || product?.product?.variants || [];
  if (!Array.isArray(vs) || !vs.length) return [];

  return vs.map((v: any) => ({
    id: String(v.id || v.admin_graphql_api_id || v.sku || ''),
    title: v.title || 'Variant',
    options: normalizeOptions(v),
    available: v.availableForSale ?? v.available ?? true,
    price:
      v.price_amount
        ? `$${Number(v.price_amount).toFixed(2)}`
        : v.price
        ? `$${Number(v.price).toFixed(2)}`
        : undefined,
    currencyCode: v.currencyCode || 'USD',
  }));
}

function buildOptionGroups(variants: Variant[]) {
  const groups = new Map<string, Set<string>>();

  variants.forEach((v) => {
    (v.options || []).forEach((o) => {
      if (!o?.name || !o?.value) return;
      if (!groups.has(o.name)) groups.set(o.name, new Set());
      groups.get(o.name)!.add(o.value);
    });
  });

  const out: Record<string, string[]> = {};
  groups.forEach((set, name) => {
    out[name] = Array.from(set);
  });
  return out;
}

function findMatchingVariant(
  variants: Variant[],
  selected: Record<string, string>
) {
  return (
    variants.find((v) =>
      Object.entries(selected).every(([name, value]) =>
        v.options?.some((o) => o.name === name && o.value === value)
      )
    ) || null
  );
}

function SentimentLine({ sentiment }: { sentiment: Enriched['sentiment'] }) {
  if (!sentiment || typeof sentiment.positive !== 'number') return null;
  const pct = Math.round((sentiment.positive ?? 0) * 100);
  return <div className="text-xs text-white/70">Sentiment: {pct}% positive</div>;
}

function CheckoutForm({
  product,
  onClose,
  onOrderComplete,
}: {
  product: ShoppingProduct;
  onClose: () => void;
  onOrderComplete: (
    product: ShoppingProduct,
    checkoutIntent: CheckoutIntent
  ) => void;
}) {
  const { bt } = useBasisTheory();
  const cardRef = useRef<ICardElement | null>(null);

  const [step, setStep] = useState<'buyer-info' | 'loading-offer' | 'payment'>(
    'buyer-info'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutIntent, setCheckoutIntent] = useState<any | null>(null);

  const [enriched, setEnriched] = useState<Enriched | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {}
  );

  const source = (product as any)?.source === 'shopify' ? 'shopify' : 'rye';

  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') || '',
    []
  );
  const apiUrl = (path: string) => (apiBase ? `${apiBase}${path}` : path);

  async function safeJsonFetch(path: string, init?: RequestInit) {
    const res = await fetch(apiUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(init?.headers || {}),
      },
    });

    const raw = await res.text();
    let json: any = null;

    try {
      json = JSON.parse(raw);
    } catch {
      console.error('[safeJsonFetch] Non-JSON response:', raw.slice(0, 500));
      throw new Error('Server returned non-JSON response.');
    }

    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setEnrichLoading(true);
      setError(null);

      try {
        const url =
          (product as any).url ||
          (product as any).productUrl ||
          (product as any).merchantUrl;

        if (!url) throw new Error('Missing product URL');

        const json = await safeJsonFetch('/api/products/enrich', {
          method: 'POST',
          body: JSON.stringify({ url, source }),
        });

        const normalized = normalizeEnrich(json);

        // fallback to shopify variants if rye misses (ONLY for shopify)
        let variants = normalized?.variants || [];
        if (!variants.length && source === 'shopify') {
          variants = normalizeShopifyVariants(product);
        }

        const patched: Enriched = normalized
          ? {
              ...normalized,
              variants,
              brand:
                normalized.brand ||
                (product as any)?.vendor ||
                (product as any)?.brand ||
                '',
            }
          : {
              brand: (product as any)?.vendor || '',
              title: product.name || '',
              description: (product as any).description || '',
              images: [upgradeImageUrl((product as any).imageUrl)]
                .filter(Boolean) as string[],
              price: product.price || 'Varies',
              currencyCode: 'USD',
              variants,
              highlights: [],
              sentiment: null,
              reviews: [],
              reviewSummary: null,
              likes: [],
              dislikes: [],
              sentimentPct: null,
            };

        if (!cancelled) {
          setEnriched(patched);

          const first =
            patched.variants.find((v) => v.available) || patched.variants[0];

          setSelectedVariantId(first?.id || null);

          const initOpts: Record<string, string> = {};
          first?.options?.forEach((o) => {
            if (o?.name && o?.value) initOpts[o.name] = o.value;
          });
          setSelectedOptions(initOpts);
        }
      } catch (e: any) {
        if (!cancelled) {
          setEnriched(null);
          setError(e?.message || 'Failed to load product details');
        }
      } finally {
        if (!cancelled) setEnrichLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [product, source]);

  const variants = enriched?.variants || [];
  const optionGroups = useMemo(() => buildOptionGroups(variants), [variants]);

  useEffect(() => {
    if (!variants.length) return;
    const match = findMatchingVariant(variants, selectedOptions);
    if (match) setSelectedVariantId(match.id);
  }, [selectedOptions, variants]);

  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) || null;

  const [buyerInfo, setBuyerInfo] = useState<Buyer>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    province: '',
    country: 'US',
    postalCode: '',
  });

  const handleBuyerInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const productUrl =
        (product as any).url ||
        (product as any).productUrl ||
        (product as any).merchantUrl;

      if (!productUrl || typeof productUrl !== 'string') {
        setError('This product is missing a valid URL.');
        setLoading(false);
        return;
      }

      const json = await safeJsonFetch('/api/checkout/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          buyer: buyerInfo,
          quantity: 1,
          productUrl,
          // only pass variantId if it's real
          variantId: selectedVariant?.id || undefined,
          selectedOptions: selectedVariant?.options || undefined,
        }),
      });

      const intent = json.checkoutIntent;
      setCheckoutIntent(intent);

      if (intent.state !== 'awaiting_confirmation') {
        setStep('loading-offer');
        pollCheckoutIntentState(intent.id);
      } else {
        setStep('payment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutIntent) return;

    if (!bt) {
      setError('Payment system not ready. Refresh and try again.');
      return;
    }
    if (!cardRef.current) {
      setError('Card input not ready. Please try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await bt.tokens.create({
        type: 'card',
        data: cardRef.current,
        metadata: {
          name: `${buyerInfo.firstName} ${buyerInfo.lastName}`,
          address_line1: buyerInfo.address1,
          address_line2: buyerInfo.address2,
          address_city: buyerInfo.city,
          address_state: buyerInfo.province,
          address_postal_code: buyerInfo.postalCode,
          address_country: buyerInfo.country,
        },
      });

      if (!token?.id) throw new Error('Card tokenization failed.');

      await safeJsonFetch('/api/checkout/confirm-intent', {
        method: 'POST',
        body: JSON.stringify({
          checkoutIntentId: checkoutIntent.id,
          basisTheoryToken: token.id,
        }),
      });

      pollCheckoutIntentState(checkoutIntent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setLoading(false);
    }
  };

  const pollCheckoutIntentState = async (checkoutIntentId: string) => {
    try {
      const json = await safeJsonFetch(
        `/api/checkout/get-intent?checkoutIntentId=${checkoutIntentId}`
      );

      const updatedIntent = json.checkoutIntent;

      switch (updatedIntent.state) {
        case 'awaiting_confirmation':
          if (updatedIntent.offer) {
            setCheckoutIntent(updatedIntent);
            setStep('payment');
          } else {
            setTimeout(() => pollCheckoutIntentState(checkoutIntentId), 2000);
          }
          break;
        case 'placing_order':
          setTimeout(() => pollCheckoutIntentState(checkoutIntentId), 1000);
          break;
        case 'completed':
          onOrderComplete(product, updatedIntent);
          onClose();
          setLoading(false);
          break;
        case 'failed':
          setError('Order failed. Please try again.');
          setLoading(false);
          break;
        default:
          setTimeout(() => pollCheckoutIntentState(checkoutIntentId), 2000);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to get checkout information.');
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof Buyer, value: string) => {
    setBuyerInfo((prev) => ({ ...prev, [field]: value }));
  };

  const inputClass =
    'w-full px-3 py-2 bg-[#1F252E] text-white border border-[#374353] rounded-md ' +
    'focus:outline-none focus:ring-2 focus:ring-[#47C2EB] focus:border-transparent';

  const displayBrand =
    enriched?.brand ||
    (product as any)?.vendor ||
    (product as any)?.brand ||
    '';

  const displayTitle = enriched?.title || product.name || 'Product';

  const displayPrice =
    selectedVariant?.price ||
    enriched?.price ||
    product.price ||
    'Varies';

  const candidateImage =
    enriched?.images?.[0] ||
    upgradeImageUrl((product as any).imageUrl) ||
    '';

  const displayImage = isValidImageSrc(candidateImage)
    ? upgradeImageUrl(candidateImage)
    : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Product Details</h3>

        <div className="bg-[#1F252E] border border-[#374353] rounded-xl p-5 space-y-3">
          {displayImage ? (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-[#14191F]">
              <Image
                src={displayImage}
                alt={displayTitle}
                fill
                className="object-contain"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 70vw, 50vw"
                quality={92}
                priority
              />
            </div>
          ) : (
            <div className="w-full aspect-video rounded-lg bg-[#14191F] flex items-center justify-center text-white/40 text-sm">
              No image
            </div>
          )}

          {/* Brand / Title / Price on separate lines */}
          <div className="space-y-1">
            {displayBrand && (
              <div className="text-xs uppercase tracking-wide text-white/60">
                {displayBrand}
              </div>
            )}
            <h4 className="font-medium text-white text-base">
              {enrichLoading ? 'Loading details…' : displayTitle}
            </h4>
            <p className="text-xl font-bold text-[#47C2EB]">{displayPrice}</p>
          </div>

          {/* OPTION PILLS if we have real option groups */}
          {!!variants.length && Object.keys(optionGroups).length > 0 && (
            <div className="pt-2 space-y-3">
              {Object.entries(optionGroups).map(([name, values]) => (
                <div key={name} className="space-y-1">
                  <div className="text-sm text-white/80 font-medium">{name}</div>
                  <div className="flex flex-wrap gap-2">
                    {values.map((value) => {
                      const active = selectedOptions[name] === value;
                      const hypothetical = { ...selectedOptions, [name]: value };
                      const canMatch =
                        findMatchingVariant(variants, hypothetical) != null;

                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={!canMatch}
                          onClick={() =>
                            setSelectedOptions((prev) => ({
                              ...prev,
                              [name]: value,
                            }))
                          }
                          className={[
                            'px-3 py-1 rounded-lg text-sm border transition',
                            active
                              ? 'bg-[#47C2EB] text-black border-[#47C2EB]'
                              : 'bg-[#14191F] text-white border-[#374353]',
                            !canMatch
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:border-white/60',
                          ].join(' ')}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DROPDOWN if variants are real but no groups */}
          {!!variants.length && Object.keys(optionGroups).length === 0 && (
            <div className="pt-3 space-y-2">
              <div className="text-sm text-white/80 font-medium">Variant</div>
              <select
                className={inputClass}
                value={selectedVariantId || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedVariantId(id);
                }}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id} disabled={!v.available}>
                    {v.title}
                    {!v.available ? ' (sold out)' : ''}
                    {v.price ? ` — ${v.price}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* NO VARIANTS */}
          {!variants.length && (
            <div className="pt-3 text-sm text-white/60">
              This merchant requires selecting size/color on their site at checkout.
            </div>
          )}
        </div>

        {/* Highlights */}
        <div className="bg-[#1F252E] border border-[#374353] rounded-xl p-4 space-y-2">
          <div className="font-medium text-white">Highlights</div>
          {enrichLoading ? (
            <div className="text-sm text-white/60">Loading highlights…</div>
          ) : enriched?.highlights?.length ? (
            <ul className="list-disc pl-5 text-sm text-white/80 space-y-1">
              {enriched.highlights.slice(0, 5).map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-white/60">No highlights available.</div>
          )}
          <SentimentLine sentiment={enriched?.sentiment || null} />
        </div>

        {/* Review Summary */}
        <div className="bg-[#1F252E] border border-[#374353] rounded-xl p-4 space-y-2">
          <div className="font-medium text-white">Review Summary</div>
          {enrichLoading ? (
            <div className="text-sm text-white/60">Summarizing reviews…</div>
          ) : enriched?.reviewSummary ? (
            <div className="text-sm text-white/80">
              {enriched.reviewSummary}
            </div>
          ) : (
            <div className="text-sm text-white/60">
              No review summary available.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT (shipping + payment) */}
      <div className="space-y-4">
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-200 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {step === 'buyer-info' && (
          <form onSubmit={handleBuyerInfoSubmit} className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              Shipping Details
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="First name"
                value={buyerInfo.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                required
              />
              <input
                className={inputClass}
                placeholder="Last name"
                value={buyerInfo.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                required
              />
            </div>

            <input
              className={inputClass}
              placeholder="Email"
              type="email"
              value={buyerInfo.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
            <input
              className={inputClass}
              placeholder="Phone"
              value={buyerInfo.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              required
            />

            <input
              className={inputClass}
              placeholder="Address line 1"
              value={buyerInfo.address1}
              onChange={(e) => handleInputChange('address1', e.target.value)}
              required
            />
            <input
              className={inputClass}
              placeholder="Address line 2 (optional)"
              value={buyerInfo.address2}
              onChange={(e) => handleInputChange('address2', e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="City"
                value={buyerInfo.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                required
              />
              <input
                className={inputClass}
                placeholder="State / Province"
                value={buyerInfo.province}
                onChange={(e) => handleInputChange('province', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="ZIP / Postal code"
                value={buyerInfo.postalCode}
                onChange={(e) =>
                  handleInputChange('postalCode', e.target.value)
                }
                required
              />
              <select
                className={inputClass}
                value={buyerInfo.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
              </select>
            </div>

            <button
              disabled={loading}
              className="w-full bg-[#47C2EB] hover:bg-[#3AB5DE] text-black font-semibold py-2 rounded-lg disabled:opacity-60"
            >
              {loading ? 'Creating checkout…' : 'Continue to Payment'}
            </button>
          </form>
        )}

        {step === 'loading-offer' && (
          <div className="text-white/80 text-sm">
            Loading offer from merchant…
          </div>
        )}

        {step === 'payment' && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Payment</h3>

            <div className="bg-[#1F252E] border border-[#374353] rounded-lg p-3">
              <CardElement ref={cardRef} />
            </div>

            <button
              disabled={loading}
              className="w-full bg-[#47C2EB] hover:bg-[#3AB5DE] text-black font-semibold py-2 rounded-lg disabled:opacity-60"
            >
              {loading ? 'Placing order…' : 'Place Order'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function CheckoutModal({
  isOpen,
  onClose,
  product,
  onOrderComplete,
}: CheckoutModalProps) {
  if (!isOpen) return null;

  const btKey = process.env.NEXT_PUBLIC_BASIS_THEORY_PUBLIC_KEY!;
  const { bt, error } = useBasisTheory(btKey, { elements: true });

  return (
    <BasisTheoryProvider bt={bt}>
      <div className="fixed inset-0 bg-black/70 z-50">
        <div className="min-h-screen w-full p-3 sm:p-6 flex items-start justify-center">
          <div className="bg-[#14191F] border border-[#374353] rounded-2xl shadow-xl max-w-6xl w-full h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-6 sticky top-0 bg-[#14191F] z-10 border-b border-[#242B36]">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Purchase Product</h2>
                <button
                  onClick={onClose}
                  className="text-[#9FA3A7] hover:text-white text-2xl"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain touch-pan-y flex-1">
              {error ? (
                <div className="p-4 bg-[#1F252E] border border-[#374353] rounded-md text-red-400">
                  Basis Theory init failed: {String(error)}
                </div>
              ) : (
                <CheckoutForm
                  product={product}
                  onClose={onClose}
                  onOrderComplete={onOrderComplete}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </BasisTheoryProvider>
  );
}