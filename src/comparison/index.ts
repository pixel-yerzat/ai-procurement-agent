import { ExtractedItem } from "../agent";

// Weights for multi-criteria scoring
const WEIGHT = { price: 0.6, delivery: 0.25, terms: 0.15 };

export interface SupplierSummary {
  supplierId: string;
  supplierName: string;
  phone: string;
  items: ExtractedItem[];
  deliveryDays: number | null;
  paymentTerms: string | null;
  currency: string | null;
  minUnitPrice: number | null;
  score: number;
  justification: string;
}

export interface ComparisonResult {
  ranked: SupplierSummary[];
  best: SupplierSummary | null;
}

export function compareOffers(suppliers: {
  supplierId: string;
  supplierName: string;
  phone: string;
  items: ExtractedItem[];
  deliveryDays: number | null;
  paymentTerms: string | null;
}[]): ComparisonResult {
  if (suppliers.length === 0) return { ranked: [], best: null };

  const summaries: SupplierSummary[] = suppliers.map((s) => {
    const prices = s.items
      .map((i) => i.unitPrice)
      .filter((p): p is number => p !== null);
    const minUnitPrice = prices.length > 0 ? Math.min(...prices) : null;
    const currency = s.items.find((i) => i.currency)?.currency ?? null;

    return {
      ...s,
      minUnitPrice,
      currency,
      score: 0,
      justification: "",
    };
  });

  // Normalise: lower price → higher score
  const allPrices = summaries.map((s) => s.minUnitPrice).filter((p): p is number => p !== null);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);

  // Normalise: lower delivery → higher score
  const allDelivery = summaries.map((s) => s.deliveryDays).filter((d): d is number => d !== null);
  const minDelivery = Math.min(...allDelivery);
  const maxDelivery = Math.max(...allDelivery);

  for (const s of summaries) {
    let priceScore = 0;
    let deliveryScore = 0;
    let termsScore = 0;
    const reasons: string[] = [];

    if (s.minUnitPrice !== null && maxPrice !== minPrice) {
      priceScore = (maxPrice - s.minUnitPrice) / (maxPrice - minPrice);
    } else if (s.minUnitPrice !== null) {
      priceScore = 1;
    }

    if (s.deliveryDays !== null && maxDelivery !== minDelivery) {
      deliveryScore = (maxDelivery - s.deliveryDays) / (maxDelivery - minDelivery);
    } else if (s.deliveryDays !== null) {
      deliveryScore = 1;
    }

    // Simple heuristic: prepayment = 0, net30 = 0.5, net60+ = 1
    const terms = (s.paymentTerms ?? "").toLowerCase();
    if (terms.includes("60") || terms.includes("90")) {
      termsScore = 1;
      reasons.push("отсрочка платежа 60+ дней");
    } else if (terms.includes("30")) {
      termsScore = 0.5;
      reasons.push("отсрочка 30 дней");
    } else if (terms.includes("предоплат") || terms.includes("prepay")) {
      termsScore = 0;
    }

    s.score =
      WEIGHT.price * priceScore +
      WEIGHT.delivery * deliveryScore +
      WEIGHT.terms * termsScore;

    if (s.minUnitPrice !== null) {
      reasons.unshift(`цена ${s.minUnitPrice} ${s.currency ?? ""}`);
    }
    if (s.deliveryDays !== null) {
      reasons.push(`доставка ${s.deliveryDays} дн.`);
    }
    s.justification = reasons.join(", ");
  }

  const ranked = summaries.sort((a, b) => b.score - a.score);
  const best = ranked[0] ?? null;
  if (best) {
    best.justification = `Лучшее предложение: ${best.justification}`;
  }

  return { ranked, best };
}
