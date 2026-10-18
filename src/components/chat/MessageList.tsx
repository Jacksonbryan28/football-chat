import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { Message } from './types';

// The conversation. Keeps the newest message in view as it streams in.
export function MessageList({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  return (
    <>
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={bottomRef} />
    </>
  );
}
