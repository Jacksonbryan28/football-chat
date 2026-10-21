import type { APIRoute } from 'astro';
import { isStepCount, streamText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { getModel } from '../../lib/model';
import { buildSystemPrompt } from '../../lib/prompt';
import { teamsFromToolInput, teamsFromToolResult } from '../../lib/teamHints';
import { footballTools } from '../../lib/tools';

export const prerender = false;

const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;

const body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(MAX_CHARS),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES),
});

// The browser reads one JSON object per line:
//   {type:'text', text}      a piece of the answer
//   {type:'reset'}           the model is about to call a tool; drop any text so far
//   {type:'tool', name, input}   a tool is being used (shown as a source chip)
//   {type:'teams', teams}    team abbreviations the current lookup is about (drives the loading helmet)
//   {type:'error', message}  something went wrong (message is safe to show)
type Event =
  | { type: 'text'; text: string }
  | { type: 'reset' }
  | { type: 'tool'; name: string; input: unknown }
  | { type: 'teams'; teams: string[] }
  | { type: 'error'; message: string };

function friendlyError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (/quota|rate.?limit|429|RESOURCE_EXHAUSTED/i.test(text)) {
    return "I'm getting too many requests right now. Wait a moment and try again.";
  }
  if (/GOOGLE_GENERATIVE_AI_API_KEY|API key/i.test(text)) {
    return 'The AI key is missing or invalid. Check the API key in .env.';
  }
  return 'Something went wrong while answering. Please try again.';
}

export const POST: APIRoute = async ({ request }) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Send {"messages":[{"role","content"}]} (max 20 messages, 2000 characters each).' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Event) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      try {
        const result = streamText({
          model: getModel(),
          system: buildSystemPrompt(),
          messages: parsed.data.messages as ModelMessage[],
          tools: footballTools,
          stopWhen: isStepCount(8),
          abortSignal: request.signal,
        });

        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            send({ type: 'text', text: part.text });
          } else if (part.type === 'tool-call') {
            send({ type: 'reset' });
            send({ type: 'tool', name: part.toolName, input: part.input });
            const teams = teamsFromToolInput(part.input);
            if (teams.length) send({ type: 'teams', teams });
          } else if (part.type === 'tool-result') {
            const teams = teamsFromToolResult(part.output);
            if (teams.length) send({ type: 'teams', teams });
          } else if (part.type === 'error') {
            console.error('chat stream error:', part.error);
            send({ type: 'error', message: friendlyError(part.error) });
          }
        }
      } catch (err) {
        console.error('chat error:', err);
        send({ type: 'error', message: friendlyError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};
