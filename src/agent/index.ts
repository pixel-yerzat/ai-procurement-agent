import OpenAI from "openai";
import { config } from "../config";
import { SYSTEM_PROMPT } from "./prompts";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentResponse {
  reply: string;
  extracted: ExtractedOffer | null;
  missingFields: string[];
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

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function processSupplierMessage(
  supplierMessage: string,
  documentText: string | null,
  history: HistoryMessage[]
): Promise<AgentResponse> {
  const userContent = documentText
    ? `${supplierMessage}\n\n[Document content]:\n${documentText}`
    : supplierMessage;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ];

  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  let parsed: AgentResponse;
  try {
    parsed = JSON.parse(raw) as AgentResponse;
  } catch {
    parsed = {
      reply: raw,
      extracted: null,
      missingFields: [],
    };
  }

  return parsed;
}
