import { cn } from '@/lib/utils';
import { Markdown } from '../Markdown';
import { LoadingIndicator } from './LoadingIndicator';
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
          <LoadingIndicator teams={m.teams} lookingUp={m.tools.length > 0} />
        ) : (
          <Markdown text={m.content} />
        )}
      </div>

      {!isUser && m.status === 'done' && <SourceChips tools={m.tools} />}
    </div>
  );
}
