// src/app/embed/layout.tsx
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Paceline Assistant',
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <div
      id="paceline-embed-root"
      style={{
        minHeight: '100vh',
        background: '#14191F',
        color: '#FFFFFF',
        margin: 0,
        padding: 0,
      }}
    >
      {children}
    </div>
  );
}