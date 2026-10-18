import type { FormEvent, KeyboardEvent, RefObject } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

// The message box and send button, pinned to the bottom of the screen.
// Enter sends; Shift+Enter adds a new line.
export function Composer({ value, onChange, onSubmit, busy, inputRef }: ComposerProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky bottom-0 flex items-end gap-2 bg-gradient-to-t from-background from-75% to-transparent py-3"
    >
      <label htmlFor="chat-input" className="sr-only">
        Your question
      </label>
      <Textarea
        id="chat-input"
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about NFL stats…"
        maxLength={2000}
        rows={1}
        autoFocus
        className="max-h-40 min-h-10 resize-none rounded-xl bg-card px-3.5 py-2 md:text-base"
      />
      <Button type="submit" size="icon-lg" disabled={busy || !value.trim()} className="rounded-xl">
        <ArrowUp />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );
}
