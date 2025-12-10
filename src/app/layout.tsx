// src/app/layout.tsx
'use client';

import "./globals.css";
import { Header } from "@/components/Header";
import { usePathname } from "next/navigation";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isEmbed = pathname?.startsWith("/embed");

  return (
    <html lang="en">
      <body className={isEmbed ? "bg-[#14191F] text-white" : undefined}>
        {!isEmbed && <Header />}

        <main
          className={
            isEmbed
              ? "flex flex-1 flex-col min-h-screen bg-[#14191F]"
              : "bg-muted/50 flex flex-1 flex-col pt-16 min-h-[calc(100vh-4rem)]"
          }
        >
          {children}
        </main>
      </body>
    </html>
  );
}