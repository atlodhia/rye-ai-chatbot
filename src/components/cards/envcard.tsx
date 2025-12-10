'use client';

import { useEffect, useState } from 'react';

export default function EnvCard() {
  const [needsKey, setNeedsKey] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch('/api/ai-availability', {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!cancelled) setNeedsKey(!data.ok);
      } catch (e) {
        // If we can’t tell, fail open (don’t block UI)
        if (!cancelled) setNeedsKey(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (needsKey === null || needsKey === false) return null;

  return (
    <div className="absolute inset-0 top-10 left-0 right-0 flex items-center justify-center w-md pointer-events-none">
      <div className="bg-red-500 text-slate-50 shadow-md p-2 leading-tight pointer-events-auto">
        <h2 className="text-sm font-bold">Heads up!</h2>
        <p className="text-xs flex flex-col">
          <span>You need to add an OPENAI_API_KEY as an environment variable.</span>
          <span>See the .env.example file for an example.</span>
        </p>
      </div>
    </div>
  );
}