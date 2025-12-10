// src/app/embed/page.tsx
'use client';

import Chat from '@/components/Chat';

/**
 * Root embed entry.
 * Fixed-height embed viewport that allows Chat to manage its own scrolling.
 * We avoid overflow-hidden + h-screen combo that was clipping the input.
 */
export default function EmbedPage() {
  return (
    <main className="w-full h-screen bg-[#14191F] text-white flex flex-col">
      {/* min-h-0 is important so the child can shrink and scroll correctly */}
      <div className="flex-1 min-h-0">
        <Chat />
      </div>
    </main>
  );
}