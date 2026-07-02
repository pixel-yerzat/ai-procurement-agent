import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import Tesseract from "tesseract.js";

export interface ParseResult {
  text: string;
  confidence?: number;
  warning?: string;
}

export async function parseFile(filePath: string): Promise<ParseResult> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".pdf":
      return parsePdf(filePath);
    case ".docx":
    case ".doc":
      return parseWord(filePath);
    case ".xlsx":
    case ".xls":
    case ".csv":
      return parseExcel(filePath);
    case ".jpg":
    case ".jpeg":
    case ".png":
    case ".webp":
    case ".bmp":
      return parseImage(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

// Returns ratio of readable printable characters (0–1)
function textQuality(text: string): number {
  if (!text.length) return 0;
  const readable = text.split("").filter((c) => {
    const code = c.charCodeAt(0);
    // Allow: ASCII printable, Cyrillic, Kazakh letters, common punctuation
    return (
      (code >= 32 && code <= 126) ||   // ASCII printable
      (code >= 0x0400 && code <= 0x04ff) || // Cyrillic
      (code >= 0x0500 && code <= 0x052f) || // Cyrillic supplement
      code === 0x04b0 || code === 0x04b1 || // Kazakh Ұ ұ
      c === "\n" || c === "\r" || c === "\t"
    );
  });
  return readable.length / text.length;
}

async function parsePdf(filePath: string): Promise<ParseResult> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  const text = data.text.trim();

  // If text layer is empty or mostly garbage, fall back to OCR
  if (!text || textQuality(text) < 0.6) {
    console.log("[Parser] PDF text layer poor quality — trying OCR fallback");
    return parseImage(filePath);
  }

  return { text };
}

async function parseWord(filePath: string): Promise<ParseResult> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();

  if (!text) {
    return {
      text: "",
      warning: "Word document appears to be empty or has no extractable text.",
    };
  }

  return { text };
}

function parseExcel(filePath: string): ParseResult {
  const workbook = XLSX.readFile(filePath);
  const lines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    // Skip completely empty sheets
    const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim()));
    if (!nonEmpty.length) continue;

    lines.push(`=== ${sheetName} ===`);
    for (const row of nonEmpty) {
      lines.push(row.map((c) => String(c)).join("\t"));
    }
  }

  if (!lines.length) {
    return { text: "", warning: "Excel file contains no readable data." };
  }

  return { text: lines.join("\n").trim() };
}

async function parseImage(filePath: string): Promise<ParseResult> {
  const { data } = await Tesseract.recognize(filePath, "rus+eng+kaz");
  const text = data.text.trim();
  const confidence = data.confidence / 100;

  if (confidence < 0.4 || !text) {
    return {
      text: "",
      confidence,
      warning: "Image quality is too low for reliable text extraction (OCR confidence: " +
        Math.round(confidence * 100) + "%). Please send a clearer photo or typed document.",
    };
  }

  return { text, confidence };
}
