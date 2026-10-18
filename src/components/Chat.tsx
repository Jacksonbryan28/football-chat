import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Markdown } from './Markdown';

interface Tool {
  name: string;
  input: Record<string, unknown>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools: Tool[];
  // pending: waiting for text, streaming: text arriving, done: finished, error: failed
  status: 'pending' | 'streaming' | 'done' | 'error';
}

const EXAMPLES = [
  'How many passing yards did Patrick Mahomes have in 2023?',
  'Who won Super Bowl LVIII and what was the score?',
  'Who led the NFL in rushing yards last season?',
  'Show the 2022 NFC East standings',
];

function chipLabel(tool: Tool) {
  const details = Object.values(tool.input)
    .filter((v) => v !== undefined)
    .join(' · ');
  return `${tool.name.replace(/_/g, ' ')}${details ? ' · ' + details : ''}`;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function ask(question: string) {
    const text = question.trim();
    if (busy || !text) return;
    setBusy(true);
    setInput('');

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, tools: [], status: 'done' };
    const botId = crypto.randomUUID();
    const history = [...messages, userMsg]
      .filter((m) => m.status === 'done')
      .map(({ role, content }) => ({ role, content }))
      .slice(-20);

    setMessages((prev) => [...prev, userMsg, { id: botId, role: 'assistant', content: '', tools: [], status: 'pending' }]);

    const patchBot = (fn: (m: Message) => Message) =>
      setMessages((prev) => prev.map((m) => (m.id === botId ? fn(m) : m)));

    // Marks this turn as failed: the error shows in the answer bubble, the question
    // goes back in the box, and neither is sent as history on the next try.
    const fail = (message: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId ? { ...m, status: 'error', content: message } : m.id === userMsg.id ? { ...m, status: 'error' } : m,
        ),
      );
      setInput(text);
    };

    let failed = false;
    let gotText = false;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) throw new Error('bad response');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const handle = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === 'text') {
          gotText = true;
          patchBot((m) => ({ ...m, content: m.content + event.text, status: 'streaming' }));
        } else if (event.type === 'reset') {
          gotText = false;
          patchBot((m) => ({ ...m, content: '', status: 'pending' }));
        } else if (event.type === 'tool') {
          patchBot((m) => ({ ...m, tools: [...m.tools, { name: event.name, input: event.input ?? {} }] }));
        } else if (event.type === 'error') {
          failed = true;
          fail(event.message);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(handle);
      }
      handle(buffer);

      if (!failed) {
        if (gotText) patchBot((m) => ({ ...m, status: 'done' }));
        else fail('I did not get an answer. Please try again.');
      }
    } catch {
      fail("Couldn't reach the server. Check that it's running and try again.");
    }

    setBusy(false);
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      ask(input);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4">
      <header className="pt-7 pb-3">
        <h1 className="text-xl font-semibold tracking-tight">football-chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask about NFL stats. Answers come from real data, not memory.</p>
      </header>

      <main className="flex flex-1 flex-col gap-4 pt-3 pb-6" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && (
          <section>
            <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Try asking</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  className="h-auto justify-start rounded-xl px-3.5 py-3 text-left text-sm whitespace-normal"
                  onClick={() => ask(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </section>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn('flex flex-col gap-1.5', m.role === 'user' && 'items-end')}>
            <div
              className={cn(
                'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-relaxed break-words',
                m.role === 'user' && 'rounded-br-sm bg-primary whitespace-pre-wrap text-primary-foreground',
                m.role === 'assistant' && 'rounded-bl-sm border bg-card text-card-foreground',
                m.status === 'error' && m.role === 'assistant' && 'border-transparent bg-destructive/10 text-destructive',
              )}
            >
              {m.role === 'user' || m.status === 'error' ? (
                m.content
              ) : m.status === 'pending' ? (
                <div className="flex flex-col gap-2 py-1" role="status">
                  <span className="sr-only">{m.tools.length ? 'Looking that up…' : 'Thinking…'}</span>
                  <Skeleton className="h-3.5 w-56" />
                  <Skeleton className="h-3.5 w-36" />
                </div>
              ) : (
                <Markdown text={m.content} />
              )}
            </div>

            {m.role === 'assistant' && m.status === 'done' && m.tools.length > 0 && (
              <div className="flex max-w-[92%] flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Data used:</span>
                {m.tools.map((tool, i) => (
                  <Badge key={i} variant="secondary" className="h-auto font-mono" title={JSON.stringify(tool.input)}>
                    {chipLabel(tool)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 flex items-end gap-2 bg-gradient-to-t from-background from-75% to-transparent py-3"
      >
        <label htmlFor="chat-input" className="sr-only">
          Your question
        </label>
        <Textarea
          id="chat-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about NFL stats…"
          maxLength={2000}
          rows={1}
          autoFocus
          className="max-h-40 min-h-10 resize-none rounded-xl bg-card px-3.5 py-2 md:text-base"
        />
        <Button type="submit" size="icon-lg" disabled={busy || !input.trim()} className="rounded-xl">
          <ArrowUp />
          <span className="sr-only">Send</span>
        </Button>
      </form>

      <footer className="pb-5 text-center text-xs text-muted-foreground">
        Data from{' '}
        <a className="underline" href="https://github.com/nflverse/nflverse-data">
          nflverse
        </a>{' '}
        ·{' '}
        <a className="underline" href="/data">
          Data check
        </a>
      </footer>
    </div>
  );
}
