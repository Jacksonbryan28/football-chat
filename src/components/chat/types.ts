export interface Tool {
  name: string;
  input: Record<string, unknown>;
}

// pending: waiting for text, streaming: text arriving, done: finished, error: failed
export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools: Tool[];
  status: MessageStatus;
}
