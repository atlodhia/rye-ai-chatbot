import { UseChatToolsMessage } from '@/app/api/chat/route';
import ProductGalleryMessage from './ProductGalleryMessage';
import ReactMarkdown from 'react-markdown';
import React from 'react';

/**
 * Weekday normalizer — only for assistant text.
 * Capitalizes any standalone weekday words, case-insensitive.
 */
function normalizeWeekdays(text: string) {
  if (!text) return text;

  const weekdays = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  // Replace standalone weekday words (word boundaries),
  // preserving punctuation around them.
  return text.replace(
    new RegExp(`\\b(${weekdays.join('|')})\\b`, 'gi'),
    (match) => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase()
  );
}

/**
 * Robustly split assistant content into:
 *  - optional leading JSON products array
 *  - trailing normal text
 *
 * This version:
 *  - only parses JSON if it *fully* parses
 *  - doesn't try to bracket-count through strings
 *  - never throws during render
 */
function splitAssistantContent(
  text: string
): { products: any[] | null; restText: string; startsLikeJson: boolean } {
  const trimmed = (text || '').trim();
  const startsLikeJson = trimmed.startsWith('[');

  if (!startsLikeJson) {
    return { products: null, restText: trimmed, startsLikeJson: false };
  }

  // Scan forward for a candidate closing bracket and attempt parse.
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== ']') continue;
    const candidate = trimmed.slice(0, i + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        const restText = trimmed.slice(i + 1).trim();

        const looksLikeProducts =
          parsed.length === 0 ||
          parsed.every(
            (p: any) =>
              p &&
              typeof p === 'object' &&
              typeof p.name === 'string' &&
              typeof p.url === 'string'
          );

        if (!looksLikeProducts) break;

        return { products: parsed, restText, startsLikeJson: true };
      }
    } catch {
      // keep scanning
    }
  }

  // No parseable array yet — likely streaming JSON.
  return { products: null, restText: trimmed, startsLikeJson: true };
}

function TextMessage({
  text,
  role,
}: {
  text: string;
  role: 'user' | 'assistant' | string;
}) {
  if (!text) return null;

  const finalText = role === 'assistant' ? normalizeWeekdays(text) : text;

  return (
    <div className="prose prose-invert prose-sm max-w-none text-white">
      <ReactMarkdown>{finalText}</ReactMarkdown>
    </div>
  );
}

function AssistantJSONProductsMessage({
  products,
  onBuyProduct,
}: {
  products: any[];
  onBuyProduct: (product: any) => void;
}) {
  const fakePart = {
    type: 'tool-searchProducts',
    state: 'ready',
    products,
  };

  return (
    <ProductGalleryMessage part={fakePart as any} onBuyProduct={onBuyProduct} />
  );
}

/** Small boundary so a single bad part doesn't kill the whole Chat */
class PartBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn('[Message PartBoundary] render error:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-sm text-white/70">
          (This message had trouble rendering.)
        </div>
      );
    }
    return this.props.children;
  }
}

function MessagePart({
  part,
  onBuyProduct,
  role,
}: {
  part: any;
  onBuyProduct: (product: any) => void;
  role: 'user' | 'assistant' | string;
}) {
  switch (part.type) {
    case 'text': {
      const { products, restText, startsLikeJson } = splitAssistantContent(
        part.text || ''
      );

      // ✅ If assistant text looks like streaming JSON but isn't parseable yet,
      // hide it to prevent raw flashes.
      if (role === 'assistant' && startsLikeJson && !products) {
        return null;
      }

      if (products) {
        return (
          <div className="space-y-3">
            <AssistantJSONProductsMessage
              products={products}
              onBuyProduct={onBuyProduct}
            />
            <TextMessage text={restText} role={role} />
          </div>
        );
      }

      return <TextMessage text={part.text} role={role} />;
    }

    case 'step-start':
      return null;

    case 'tool-searchProducts':
    case 'tool-searchAmazonProducts':
    case 'tool-searchShopifyProducts':
      return <ProductGalleryMessage part={part} onBuyProduct={onBuyProduct} />;

    case 'tool-findAllowedMerchantUrls': {
      const urls: string[] = part.urls || [];
      if (!urls.length) return null;
      return (
        <div className="text-sm space-y-2 text-white/90">
          <div className="font-medium text-white">
            Other allowed merchants to try:
          </div>
          <ul className="list-disc pl-5">
            {urls.map((u, i) => (
              <li key={i}>
                <a
                  href={u}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#47C2EB] underline"
                >
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    default:
      return null;
  }
}

export default function Message({
  message,
  onBuyProduct,
}: {
  message: UseChatToolsMessage;
  onBuyProduct: (product: any) => void;
}) {
  const parts = message.parts ?? [];

  // ✅ Detect if assistant has a tool part that is preliminary (loading/searching)
  const assistantHasPreliminaryTool =
    message.role === 'assistant' &&
    parts.some(
      (p: any) =>
        typeof p.type === 'string' &&
        p.type.startsWith('tool-') &&
        p.preliminary
    );

  // Existing: detect if we have a ready gallery so we can hide pure JSON dumps
  const assistantHasToolGallery =
    message.role === 'assistant' &&
    parts.some(
      (p: any) =>
        typeof p.type === 'string' &&
        p.type.startsWith('tool-') &&
        (p.output?.products?.length || p.products?.length)
    );

  // ✅ Option A: Show a friendly preamble when a gallery is likely to appear
  // (preliminary OR ready gallery)
  const shouldShowSearchPreamble =
    message.role === 'assistant' &&
    (assistantHasPreliminaryTool || assistantHasToolGallery);

  return (
    <div className="mb-2 sm:mb-3">
      <div className="font-semibold text-xs sm:text-sm text-white/70 mb-1">
        {message.role === 'user' ? 'You' : 'Paceline Assistant'}
      </div>

      <div
        className={`
          rounded-2xl px-4 py-3 sm:px-5 sm:py-4 border space-y-3
          ${
            message.role === 'assistant'
              ? 'bg-[#1F252E] border-[#374353]'
              : 'bg-[#14191F] border-[#374353]'
          }
        `}
      >
        {/* ✅ Option A preamble inside assistant bubble */}
        {shouldShowSearchPreamble && (
          <div className="text-sm text-white/70">
            Got it — I’m pulling a few relevant gear ideas tied to today’s story. One sec…
          </div>
        )}

        {parts.map((part, index) => {
          if (
            assistantHasToolGallery &&
            message.role === 'assistant' &&
            part.type === 'text'
          ) {
            const { products, restText, startsLikeJson } =
              splitAssistantContent(part.text || '');

            const isPureJsonDump =
              startsLikeJson && !!products && restText.length === 0;

            if (isPureJsonDump) return null;
          }

          return (
            <PartBoundary key={index}>
              <MessagePart
                part={part}
                onBuyProduct={onBuyProduct}
                role={message.role}
              />
            </PartBoundary>
          );
        })}
      </div>
    </div>
  );
}