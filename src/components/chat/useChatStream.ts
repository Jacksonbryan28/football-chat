import { useState } from 'react';
import type { Message } from './types';

// Owns the conversation and talks to /api/chat. The server streams one JSON
// object per line (see src/pages/api/chat.ts):
//   text    a piece of the answer
//   reset   the model is about to call a tool; drop any text so far
//   tool    a tool was used (shown as a "Data used" chip)
//   teams   team abbreviations the lookup is about (colors the loading helmet)
//   error   something went wrong; message is safe to show
export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  /** Sends a question. Resolves true on success, false if the turn failed. */
  async function send(text: string): Promise<boolean> {
    setBusy(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, tools: [], teams: [], status: 'done' };
    const botId = crypto.randomUUID();
    const history = [...messages, userMsg]
      .filter((m) => m.status === 'done')
      .map(({ role, content }) => ({ role, content }))
      .slice(-20);

    setMessages((prev) => [...prev, userMsg, { id: botId, role: 'assistant', content: '', tools: [], teams: [], status: 'pending' }]);

    const patchBot = (fn: (m: Message) => Message) =>
      setMessages((prev) => prev.map((m) => (m.id === botId ? fn(m) : m)));

    // Marks this turn as failed: the error shows in the answer bubble and neither
    // message is sent as history on the next try.
    const fail = (message: string) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId ? { ...m, status: 'error', content: message } : m.id === userMsg.id ? { ...m, status: 'error' } : m,
        ),
      );

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
        } else if (event.type === 'teams') {
          patchBot((m) => ({ ...m, teams: event.teams }));
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
        else {
          failed = true;
          fail('I did not get an answer. Please try again.');
        }
      }
    } catch {
      failed = true;
      fail("Couldn't reach the server. Check that it's running and try again.");
    }

    setBusy(false);
    return !failed;
  }

  return { messages, busy, send };
}
