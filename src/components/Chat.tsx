'use client';

import ChatInput from '@/components/ChatInput';
import CheckoutModal from '@/components/CheckoutModal';
import Message from '@/components/messages/Message';
import WelcomePanel from '@/components/WelcomePanel';
import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { UseChatToolsMessage } from '@/app/api/chat/route';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { ShoppingProduct, CheckoutIntent } from '@/lib/types';

type MotdPayload = {
  dayGreeting?: string;
  title?: string;
  summary?: string;
  sourceName?: string;
  sourceUrl?: string;
};

type PickPayload = {
  text: string;
  motd: MotdPayload | null;
};

export default function Chat() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const [checkoutModal, setCheckoutModal] = useState<{
    isOpen: boolean;
    product: any | null;
  }>({
    isOpen: false,
    product: null,
  });

  // ✅ This key forces a full reset of useChat + UI when bumped
  const [chatSessionKey, setChatSessionKey] = useState(0);

  // ✅ Persist MOTD across the session so follow-up typed messages still carry context
  const motdRef = useRef<MotdPayload | null>(null);

  // Shopify embed safe API base
  const apiBase = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') || '';
  const chatApiUrl = apiBase ? `${apiBase}/api/chat` : '/api/chat';

  // ✅ Key the hook usage so it reinitializes on restart
  const { messages, sendMessage, status } = useChat<UseChatToolsMessage>({
    api: chatApiUrl as any, // Type workaround for API URL
    headers: { 'ngrok-skip-browser-warning': 'true' },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    id: `paceline-embed-${chatSessionKey}`, // <— important
  } as any);

  const hasUserMessage = useMemo(
    () => (messages || []).some((m) => m.role === 'user'),
    [messages]
  );

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;

    const pinned = distanceFromBottom < 120;
    setIsPinnedToBottom(pinned);
    setShowJumpToLatest(!pinned);
  }, []);

  const lastUpdateIsPreliminaryTool = useCallback((msgs: any[]) => {
    const last = msgs[msgs.length - 1];
    if (!last) return false;

    return (
      last.parts?.some(
        (p: any) =>
          typeof p.type === 'string' &&
          p.type.startsWith('tool-') &&
          p.preliminary
      ) ?? false
    );
  }, []);

  useLayoutEffect(() => {
    if (!isPinnedToBottom) return;
    if (status === 'streaming') return;
    if (lastUpdateIsPreliminaryTool(messages)) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
      });
    });
  }, [messages, isPinnedToBottom, status, lastUpdateIsPreliminaryTool]);

  const jumpToLatest = () => {
    setIsPinnedToBottom(true);
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  };

  const handleBuyProduct = (product: any) => {
    setCheckoutModal({ isOpen: true, product });
  };

  const handleCloseCheckout = () => {
    setCheckoutModal({ isOpen: false, product: null });
  };

  // ✅ Single helper so MOTD consistently rides along
  const sendUserText = (text: string) =>
    sendMessage({
      text,
      data: motdRef.current ? { motd: motdRef.current } : undefined,
    });

  const handleOrderComplete = async (
    product: ShoppingProduct,
    checkoutIntent: CheckoutIntent
  ) => {
    await sendMessage({
      text: `Order placed for ${product.name}! Checkout Intent ID: ${checkoutIntent.id}`,
      data: motdRef.current ? { motd: motdRef.current } : undefined,
    });
  };

  // ✅ Restart handler
  const restartConversation = () => {
    setCheckoutModal({ isOpen: false, product: null });
    setChatSessionKey((k) => k + 1); // remount / reinit useChat
    motdRef.current = null; // reset MOTD too

    // reset scroll
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      setIsPinnedToBottom(true);
      setShowJumpToLatest(false);
    });
  };

  return (
    <div className="h-full w-full bg-[#14191F] text-white flex flex-col">
      {/* ✅ Tiny top bar with restart */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 border-b border-[#374353] bg-[#14191F]">
        <div className="text-xs sm:text-sm text-white/70">
          Paceline Assistant
        </div>

        {hasUserMessage && (
          <button
            onClick={restartConversation}
            className="
              text-xs sm:text-sm px-3 py-1.5 rounded-full
              bg-white/10 hover:bg-white/15 transition
              border border-white/10
            "
            type="button"
            aria-label="Restart conversation"
          >
            Restart
          </button>
        )}
      </div>

      {/* ✅ Keyed content ensures full reinit */}
      <div key={chatSessionKey} className="flex-1 flex flex-col min-h-0">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="
            flex-1 overflow-y-auto
            bg-[#14191F]
            px-3 py-4 sm:px-6
            space-y-3 sm:space-y-4
            overscroll-contain
          "
          style={{ overflowAnchor: 'none' }}
        >
          {!hasUserMessage && (
            <div style={{ overflowAnchor: 'none' }}>
              {/* ✅ IMPORTANT: persist motd + pass via data so server injects it */}
              <WelcomePanel
                onPick={({ text, motd }: PickPayload) => {
                  motdRef.current = motd; // persist for follow-ups
                  sendMessage({
                    text,
                    data: motd ? { motd } : undefined,
                  });
                }}
              />
            </div>
          )}

          {messages?.map((message) => (
            <div key={message.id} style={{ overflowAnchor: 'none' }}>
              <Message message={message} onBuyProduct={handleBuyProduct} />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {showJumpToLatest && (
          <button
            onClick={jumpToLatest}
            className="
              fixed bottom-24 right-4 z-40
              bg-[#1F252E] border border-[#374353]
              text-white text-sm px-3 py-2 rounded-full shadow-lg
              hover:bg-[#242B36] transition
            "
            type="button"
          >
            Jump to latest ↓
          </button>
        )}

        <div className="border-t border-[#374353] bg-[#14191F] px-3 py-3 sm:px-6 sm:py-4">
          <div className="max-w-5xl mx-auto">
            <ChatInput
              status={status}
              onSubmit={sendUserText}
              placeholder={
                hasUserMessage
                  ? undefined
                  : 'Have a question? A health and wellness product you are interested in? Drop it here'
              }
            />
          </div>
        </div>

        <CheckoutModal
          isOpen={checkoutModal.isOpen}
          onClose={handleCloseCheckout}
          onOrderComplete={handleOrderComplete}
          product={checkoutModal.product}
        />
      </div>
    </div>
  );
}