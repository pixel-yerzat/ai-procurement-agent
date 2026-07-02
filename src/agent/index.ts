import OpenAI from "openai";
import { config } from "../config";
import { SYSTEM_PROMPT, DOCUMENT_WRAPPER } from "./prompts";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ExtractedItem {
  name: string;
  unit: string | null;
  unitPrice: number | null;
  currency: string | null;
  quantity: number | null;
  totalPrice: number | null;
}

export interface ExtractedOffer {
  items: ExtractedItem[];
  deliveryDays: number | null;
  paymentTerms: string | null;
  validUntil: string | null;
  notes: string | null;
}

export interface AgentResponse {
  reply: string;
  procurement: ExtractedOffer | null;
  missingFields: string[];
}

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// Keep last 15 messages to avoid token overflow
const MAX_HISTORY = 15;

export async function chat(
  userMessage: string,
  documentText: string | null,
  history: HistoryMessage[]
): Promise<AgentResponse> {
  const userContent = documentText
    ? DOCUMENT_WRAPPER(userMessage, documentText)
    : userMessage;

  const trimmedHistory = history.slice(-MAX_HISTORY);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...trimmedHistory.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ];

  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    messages,
    response_format: { type: "json_object" },
    // Low temperature = factual, no hallucination
    // Rises slightly when no document (casual chat can be more natural)
    temperature: documentText ? 0.1 : 0.5,
    max_tokens: 2048,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(raw) as AgentResponse;
    return {
      reply: parsed.reply ?? "...",
      procurement: parsed.procurement ?? null,
      missingFields: parsed.missingFields ?? [],
    };
  } catch {
    return { reply: raw, procurement: null, missingFields: [] };
  }
}
