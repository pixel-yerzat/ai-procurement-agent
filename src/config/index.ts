import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  openai: {
    apiKey: required("OPENAI_API_KEY"),
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
  },
  supabase: {
    url: required("SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  whatsapp: {
    sessionPath: process.env.WA_SESSION_PATH ?? "./sessions",
  },
  reports: {
    outputDir: process.env.REPORT_OUTPUT_DIR ?? "./reports",
  },
};
