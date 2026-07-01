import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import Tesseract from "tesseract.js";

export interface ParseResult {
  text: string;
  confidence?: number; // 0–1, only for OCR
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

async function parsePdf(filePath: string): Promise<ParseResult> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return { text: data.text.trim() };
}

async function parseWord(filePath: string): Promise<ParseResult> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value.trim() };
}

function parseExcel(filePath: string): ParseResult {
  const workbook = XLSX.readFile(filePath);
  const lines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    lines.push(`=== Sheet: ${sheetName} ===`);
    for (const row of rows) {
      lines.push(row.join("\t"));
    }
  }

  return { text: lines.join("\n").trim() };
}

async function parseImage(filePath: string): Promise<ParseResult> {
  const { data } = await Tesseract.recognize(filePath, "rus+eng+kaz");
  return {
    text: data.text.trim(),
    confidence: data.confidence / 100,
  };
}
