import { Button } from '@/components/ui/button';

const EXAMPLES = [
  'How many passing yards did Patrick Mahomes have in 2023?',
  'Who won Super Bowl LVIII and what was the score?',
  'Who led the NFL in rushing yards last season?',
  'Show the 2022 NFC East standings',
];

export function ExampleQuestions({ onSelect }: { onSelect: (question: string) => void }) {
  return (
    <section>
      <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Try asking</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {EXAMPLES.map((q) => (
          <Button
            key={q}
            variant="outline"
            className="h-auto justify-start rounded-xl px-3.5 py-3 text-left text-sm whitespace-normal"
            onClick={() => onSelect(q)}
          >
            {q}
          </Button>
        ))}
      </div>
    </section>
  );
}
