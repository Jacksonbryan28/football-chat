import { Badge } from '@/components/ui/badge';
import type { Tool } from './types';

function chipLabel(tool: Tool) {
  const details = Object.values(tool.input)
    .filter((v) => v !== undefined)
    .join(' · ');
  return `${tool.name.replace(/_/g, ' ')}${details ? ' · ' + details : ''}`;
}

// The "Data used" row under an answer: one chip per database lookup.
export function SourceChips({ tools }: { tools: Tool[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="flex max-w-[92%] flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>Data used:</span>
      {tools.map((tool, i) => (
        <Badge key={i} variant="secondary" className="h-auto font-mono" title={JSON.stringify(tool.input)}>
          {chipLabel(tool)}
        </Badge>
      ))}
    </div>
  );
}
