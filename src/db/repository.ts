import { supabase } from "./client";
import { ExtractedOffer, HistoryMessage } from "../agent";

// ─── Suppliers ────────────────────────────────────────────────────────────────

export async function upsertSupplier(phone: string, name?: string) {
  const { data, error } = await supabase
    .from("suppliers")
    .upsert({ phone, name: name ?? phone }, { onConflict: "phone" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSupplierByPhone(phone: string) {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllSuppliers() {
  const { data, error } = await supabase.from("suppliers").select("*").order("created_at");
  if (error) throw error;
  return data ?? [];
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function saveMessage(
  supplierId: string,
  direction: "IN" | "OUT",
  body: string
) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ supplier_id: supplierId, direction, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMessageHistory(
  supplierId: string,
  limit = 20
): Promise<HistoryMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("direction, body")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? [])
    .reverse()
    .map((m) => ({
      role: m.direction === "IN" ? "user" : "assistant",
      content: m.body,
    }));
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function saveDocument(params: {
  supplierId: string;
  messageId?: string;
  type: string;
  filePath: string;
  parsedText?: string;
  ocrConfidence?: number;
}) {
  const { data, error } = await supabase
    .from("documents")
    .insert({
      supplier_id: params.supplierId,
      message_id: params.messageId,
      type: params.type,
      file_path: params.filePath,
      parsed_text: params.parsedText,
      ocr_confidence: params.ocrConfidence,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Offers ──────────────────────────────────────────────────────────────────

export async function saveOffer(params: {
  supplierId: string;
  documentId?: string;
  offer: ExtractedOffer;
  missingFields: string[];
}) {
  const { data, error } = await supabase
    .from("offers")
    .insert({
      supplier_id: params.supplierId,
      document_id: params.documentId,
      items: params.offer.items,
      delivery_days: params.offer.deliveryDays,
      payment_terms: params.offer.paymentTerms,
      valid_until: params.offer.validUntil,
      notes: params.offer.notes,
      missing_fields: params.missingFields,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLatestOfferPerSupplier() {
  const { data, error } = await supabase
    .from("offers")
    .select("*, suppliers(name, phone)")
    .order("received_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
