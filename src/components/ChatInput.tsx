'use client';

import { useCallback, useMemo, useState } from 'react';

export default function ChatInput({
  status,
  onSubmit,
  placeholder = 'Type your message…',
}: {
  status: string;
  onSubmit: (text: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState('');

  const isStreaming = status === 'streaming';
  const isBusy = isStreaming || status === 'submitted';

  // ✅ Type anytime except while we are actively streaming tokens
  const isEditable = !isStreaming;

  // ✅ Allow SEND anytime except while streaming
  const canSend = !isStreaming && text.trim().length > 0;

  const doSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    onSubmit(trimmed);
    setText('');
  }, [text, isStreaming, onSubmit]);

  const buttonLabel = useMemo(() => {
    if (isBusy) return 'Sending…';
    return 'Send';
  }, [isBusy]);

  return (
    <form
      className="flex gap-2 items-end"
      onSubmit={(e) => {
        e.preventDefault();
        doSubmit();
      }}
    >
      <textarea
        className="
          w-full min-h-[72px] p-3
          border border-[#374353] bg-[#1F252E] text-white
          focus:outline-none focus:ring-2 focus:ring-[#47C2EB] focus:border-transparent
          resize-none rounded-xl
          disabled:opacity-60 disabled:cursor-not-allowed
        "
        placeholder={isBusy ? 'Paceline is thinking…' : placeholder}
        disabled={!isEditable}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        cols={50}
        enterKeyHint="send"
        onKeyDownCapture={(e) => {
          // @ts-ignore
          if (e.nativeEvent?.isComposing) return;

          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            doSubmit();
          }
        }}
      />

      <button
        type="submit"
        disabled={!canSend}
        className="
          h-[44px] px-4 rounded-xl text-sm font-medium
          bg-[#47C2EB] text-black
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:brightness-110 active:brightness-95 transition
          flex items-center justify-center min-w-[74px]
        "
        aria-busy={isBusy}
      >
        {buttonLabel}
      </button>
    </form>
  );
}