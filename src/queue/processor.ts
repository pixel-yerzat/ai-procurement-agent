import { Queue, Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config";
import { parseFile } from "../parsers";
import { chat } from "../agent";
import {
  upsertSupplier,
  saveMessage,
  getMessageHistory,
  saveDocument,
  saveOffer,
} from "../db/repository";
import { sendMessage } from "../whatsapp/client";
import path from "path";

export interface MessageJobData {
  from: string;
  body: string;
  attachmentPath?: string;
}

const connection = new Redis(config.redis.url, { maxRetriesPerRequest: null });

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
};

export const messageQueue = new Queue<MessageJobData>("messages", {
  connection,
  defaultJobOptions: JOB_OPTIONS,
});

export function startWorker(): Worker {
  return new Worker<MessageJobData>(
    "messages",
    async (job: Job<MessageJobData>) => {
      const { from, body, attachmentPath } = job.data;

      // Ensure contact exists in DB
      const supplier = await upsertSupplier(from);
      const supplierId: string = supplier.id;

      // Save inbound message
      const savedMsg = await saveMessage(supplierId, "IN", body);

      // Parse attachment if present
      let parsedText: string | null = null;
      let docId: string | undefined;

      if (attachmentPath) {
        const ext = path.extname(attachmentPath).replace(".", "");
        const parsed = await parseFile(attachmentPath);
        parsedText = parsed.text;

        const doc = await saveDocument({
          supplierId,
          messageId: savedMsg.id,
          type: ext,
          filePath: attachmentPath,
          parsedText: parsed.text,
          ocrConfidence: parsed.confidence,
        });
        docId = doc.id;
      }

      // Load conversation history
      const history = await getMessageHistory(supplierId);

      // Run AI
      const result = await chat(body, parsedText, history);

      // Save procurement offer only when AI actually extracted one
      if (result.procurement) {
        await saveOffer({
          supplierId,
          documentId: docId,
          offer: result.procurement,
          missingFields: result.missingFields,
        });
      }

      // Reply to user
      await sendMessage(from, result.reply);
      await saveMessage(supplierId, "OUT", result.reply);
    },
    { connection, concurrency: 5 }
  );
}
