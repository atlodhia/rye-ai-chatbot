'use client';

import Image from 'next/image';
import { ShoppingProduct } from '@/lib/types';

type ToolPart = {
  type: string;
  state?: 'loading' | 'ready' | string;
  products?: any[];
  query?: string;
  error?: string;
  output?: { products?: any[] };
  input?: { query?: string };
};

function isValidImageSrc(src?: string | null) {
  if (!src) return false;
  const s = src.trim();
  if (!s) return false;
  return /^https?:\/\//i.test(s) || s.startsWith('/');
}

export default function ProductGalleryMessage({
  part,
  onBuyProduct,
}: {
  part: ToolPart;
  onBuyProduct: (product: any) => void;
}) {
  const products: ShoppingProduct[] = Array.isArray(part.products)
    ? (part.products as any)
    : (part.output?.products as any) || [];

  const query = part.query || part.input?.query || '';
  const isLoading = part.state === 'loading';

  if (isLoading) {
    return <div className="text-sm text-white/70">Searching…</div>;
  }

  if (part.error) {
    return (
      <div className="text-sm text-red-300">
        Error loading products: {part.error}
      </div>
    );
  }

  if (!products.length) return null;

  return (
    <div className="space-y-3">
      {query && (
        <div className="text-lg font-semibold text-white">
          Results for “{query}”
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {products.map((p, i) => {
          const imgSrc = (p as any).imageUrl;
          const canRenderImage = isValidImageSrc(imgSrc);

          return (
            <div
              key={`${p.url}-${i}`}
              className="
                min-w-[240px] max-w-[240px] snap-start
                rounded-2xl border border-[#374353]
                bg-[#11161C] overflow-hidden
              "
            >
              <div className="relative w-full aspect-square bg-black/20">
                {canRenderImage ? (
                  <Image
                    src={imgSrc}
                    alt={p.name}
                    fill
                    className="object-contain"
                    sizes="240px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                    Image not available
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2">
                <div className="text-xs text-white/60">
                  {(p as any).merchantDomain || (p as any).source}
                </div>

                <div className="text-sm font-medium leading-snug line-clamp-2">
                  {p.name}
                </div>

                <div className="text-sm text-white/90">{p.price}</div>

                {(p as any).reason && (
                  <div className="text-xs text-white/70 line-clamp-2">
                    {(p as any).reason}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="
                      flex-1 text-center text-sm px-3 py-2 rounded-xl
                      bg-white/10 hover:bg-white/15 transition
                    "
                  >
                    View
                  </a>

                  <button
                    onClick={() => onBuyProduct(p)}
                    className="
                      flex-1 text-center text-sm px-3 py-2 rounded-xl
                      bg-[#47C2EB] text-black hover:opacity-90 transition
                    "
                    type="button"
                  >
                    Buy
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}