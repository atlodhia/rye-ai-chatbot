'use client';

import { useEffect, useMemo, useState } from 'react';

type MotdPayload = {
  dayGreeting?: string;
  title?: string;
  summary?: string;
  sourceName?: string;
  sourceUrl?: string;
  dateISO?: string;
};

type RotdPayload = {
  title?: string;
  summary?: string;
  sourceName?: string;
  sourceUrl?: string;
  dateISO?: string;
};

type PickPayload = {
  text: string;                 // visible user message
  motd?: MotdPayload | null;    // hidden context for model
  rotd?: RotdPayload | null;    // hidden context for model
};

type Prompt = {
  label: string;
  text: string; // visible user text only
  kind: 'motd' | 'rotd';
};

export default function WelcomePanel({
  onPick,
}: {
  onPick: (payload: PickPayload) => void;
}) {
  const [motd, setMotd] = useState<MotdPayload | null>(null);
  const [rotd, setRotd] = useState<RotdPayload | null>(null);
  const [loadingMotd, setLoadingMotd] = useState(true);
  const [loadingRotd, setLoadingRotd] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch('/api/motd', { cache: 'no-store' });
        if (!res.ok) throw new Error('motd fetch failed');
        const data = (await res.json()) as MotdPayload;
        if (mounted) setMotd(data);
      } catch {
        if (mounted) setMotd(null);
      } finally {
        if (mounted) setLoadingMotd(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch('/api/rotd', { cache: 'no-store' });
        if (!res.ok) throw new Error('rotd fetch failed');
        const data = (await res.json()) as RotdPayload;
        if (mounted) setRotd(data);
      } catch {
        if (mounted) setRotd(null);
      } finally {
        if (mounted) setLoadingRotd(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Single canonical prompt list
  const prompts: Prompt[] = useMemo(
    () => [
      // MOTD prompts
      { label: 'Give me the gist', text: 'Give me the gist of today\'s story.', kind: 'motd' },
      { label: 'Apply to me', text: 'How should I apply today\'s story to my routine?', kind: 'motd' },
      { label: 'Gear ideas', text: 'Search for gear and products related to today\'s story from your Shopify store and other merchants.', kind: 'motd' },
      { label: 'Plan it', text: 'Build me a simple plan inspired by today\'s story.', kind: 'motd' },

      // ROTD prompts
      { label: 'Recipe gist', text: 'Give me the gist of today\'s recipe.', kind: 'rotd' },
      { label: 'Make it fit me', text: 'How should I adapt today\'s recipe to my goals?', kind: 'rotd' },
      { label: 'Shopping list', text: 'What ingredients/equipment do I need for today\'s recipe?', kind: 'rotd' },
    ],
    []
  );

  // Split CTAs by kind (keeps layout clean)
  const motdPrompts = useMemo(
    () => prompts.filter((p) => p.kind === 'motd'),
    [prompts]
  );
  const rotdPrompts = useMemo(
    () => prompts.filter((p) => p.kind === 'rotd'),
    [prompts]
  );

  const fallbackGreeting = 'Welcome back.';
  const fallbackStorySummary =
    'Ask anything about training, health, or gear. Paste a supported product link and I can review it or help you buy it.';
  const fallbackRecipeSummary =
    'Want a simple healthy recipe? I’ll drop a new one daily with quick macros + swaps.';

  const validMotdUrl =
    motd?.sourceUrl && /^https?:\/\//i.test(motd.sourceUrl)
      ? motd.sourceUrl
      : undefined;

  const validRotdUrl =
    rotd?.sourceUrl && /^https?:\/\//i.test(rotd.sourceUrl)
      ? rotd.sourceUrl
      : undefined;

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-white/10 bg-[#000000] space-y-6">
      {/* ---------- MOTD BLOCK ---------- */}
      <div className="space-y-3">
        <h2 className="text-lg sm:text-xl font-semibold text-[#FFFFFF]">
          {motd?.dayGreeting || fallbackGreeting}
        </h2>

        <div className="text-base sm:text-lg font-medium text-[#FFFFFF]">
          {motd?.title || (loadingMotd ? 'Loading today\'s topic…' : '')}
        </div>

        <p className="text-sm sm:text-base text-[#FFFFFF] leading-relaxed">
          {motd?.summary || (!loadingMotd ? fallbackStorySummary : '')}
        </p>

        {motd?.sourceName && validMotdUrl && (
          <p className="text-sm text-[#FFFFFF]">
            Read the full story on{' '}
            <a
              href={validMotdUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#47C2EB] underline"
            >
              {motd.sourceName}
            </a>
            .
          </p>
        )}

        <p className="text-sm text-[#FFFFFF]">
          Want a plan or gear picks inspired by this? Try a prompt below or ask anything in the chat.
        </p>

        {/* MOTD CTAs grouped here */}
        <div className="flex flex-wrap gap-2 pt-1">
          {motdPrompts.map((p) => (
            <button
              key={p.label}
              onClick={() =>
                onPick({
                  text: p.text,
                  motd,
                  rotd: null,
                })
              }
              className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/15 text-sm transition text-[#FFFFFF]"
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- ROTD BLOCK ---------- */}
      <div className="space-y-3 border-t border-white/10 pt-5">
        <div className="text-sm uppercase tracking-wide text-[#FFFFFF]">
          Recipe of the day
        </div>

        <div className="text-base sm:text-lg font-medium text-[#FFFFFF]">
          {rotd?.title || (loadingRotd ? 'Loading today\'s recipe…' : '')}
        </div>

        <p className="text-sm sm:text-base text-[#FFFFFF] leading-relaxed">
          {rotd?.summary || (!loadingRotd ? fallbackRecipeSummary : '')}
        </p>

        {rotd?.sourceName && validRotdUrl && (
          <p className="text-sm text-[#FFFFFF]">
            Full recipe on{' '}
            <a
              href={validRotdUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#47C2EB] underline"
            >
              {rotd.sourceName}
            </a>
            .
          </p>
        )}

        {/* ROTD CTAs grouped here */}
        <div className="flex flex-wrap gap-2 pt-1">
          {rotdPrompts.map((p) => (
            <button
              key={p.label}
              onClick={() =>
                onPick({
                  text: p.text,
                  motd: null,
                  rotd,
                })
              }
              className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/15 text-sm transition text-[#FFFFFF]"
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}