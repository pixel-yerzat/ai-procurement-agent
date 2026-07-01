import "./config"; // loads dotenv early
import { initWhatsApp } from "./whatsapp/client";
import { messageQueue, startWorker } from "./queue/processor";
import type { Message } from "whatsapp-web.js";

async function main() {
  console.log("[App] Starting AI Procurement Agent...");

  // Start BullMQ worker
  const worker = startWorker();
  worker.on("failed", (job, err) => {
    console.error(`[Queue] Job ${job?.id} failed:`, err.message);
  });

  // Start WhatsApp client
  await initWhatsApp(async (message: Message, attachmentPath?: string) => {
    await messageQueue.add("incoming", {
      from: message.from,
      body: message.body,
      attachmentPath,
    });
  });
}

main().catch((err) => {
  console.error("[App] Fatal error:", err);
  process.exit(1);
});
