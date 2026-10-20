import { Badge } from '@/components/ui/badge';
import type { Tool } from './types';

const MAX_LABEL = 140;

function chipLabel(tool: Tool) {
  const details = Object.values(tool.input)
    .filter((v) => v !== undefined)
    .join(' · ')
    .replace(/\s+/g, ' ');
  const label = `${tool.name.replace(/_/g, ' ')}${details ? ' · ' + details : ''}`;
  // run_sql chips hold a whole query; the full text stays available on hover.
  return label.length > MAX_LABEL ? label.slice(0, MAX_LABEL).trimEnd() + '…' : label;
}

// The "Data used" row under an answer: one chip per database lookup.
export function SourceChips({ tools }: { tools: Tool[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="flex max-w-[92%] flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>Data used:</span>
      {tools.map((tool, i) => (
        <Badge
          key={i}
          variant="secondary"
          className="h-auto max-w-full justify-start rounded-lg py-1 text-left font-mono break-words whitespace-normal"
          title={JSON.stringify(tool.input)}
        >
          {chipLabel(tool)}
        </Badge>
      ))}
    </div>
  );
}
