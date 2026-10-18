import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Markdown } from '../Markdown';
import { SourceChips } from './SourceChips';
import type { Message } from './types';

// One message: the bubble itself, plus the "Data used" chips under a finished answer.
export function MessageBubble({ message: m }: { message: Message }) {
  const isUser = m.role === 'user';
  const isError = m.status === 'error' && !isUser;

  return (
    <div className={cn('flex flex-col gap-1.5', isUser && 'items-end')}>
      <div
        className={cn(
          'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-relaxed break-words',
          isUser && 'rounded-br-sm bg-primary whitespace-pre-wrap text-primary-foreground',
          !isUser && 'rounded-bl-sm border bg-card text-card-foreground',
          isError && 'border-transparent bg-destructive/10 text-destructive',
        )}
      >
        {isUser || isError ? (
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

      {!isUser && m.status === 'done' && <SourceChips tools={m.tools} />}
    </div>
  );
}
