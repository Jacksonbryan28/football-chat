import { useEffect, useRef, useState } from 'react';
import { ChatFooter } from './chat/ChatFooter';
import { ChatHeader } from './chat/ChatHeader';
import { Composer } from './chat/Composer';
import { ExampleQuestions } from './chat/ExampleQuestions';
import { MessageList } from './chat/MessageList';
import { useChatStream } from './chat/useChatStream';

// The chat screen: owns the input box and wires the pieces together.
// Conversation state and streaming live in useChatStream; each piece of the
// interface is its own component in ./chat.
export default function Chat() {
  const { messages, busy, send } = useChatStream();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The page is server-rendered before React takes over. Text typed (or restored by
  // the browser) in that gap is in the box but not in state, so adopt it on startup.
  useEffect(() => {
    const typed = inputRef.current?.value;
    if (typed) setInput(typed);
  }, []);

  async function submit(question: string) {
    const text = question.trim();
    if (busy || !text) return;
    setInput('');
    const ok = await send(text);
    if (!ok) setInput(text); // put the question back so it can be retried
    inputRef.current?.focus();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4">
      <ChatHeader />

      <main className="flex flex-1 flex-col gap-4 pt-3 pb-6" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 ? <ExampleQuestions onSelect={submit} /> : <MessageList messages={messages} />}
      </main>

      <Composer value={input} onChange={setInput} onSubmit={() => submit(input)} busy={busy} inputRef={inputRef} />
      <ChatFooter />
    </div>
  );
}
