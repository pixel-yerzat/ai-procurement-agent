import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";
import { parseFile } from "../parsers";
import { processSupplierMessage } from "../agent";
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

const connection = new IORedis(config.redis.url, { maxRetriesPerRequest: null });

export const messageQueue = new Queue<MessageJobData>("messages", { connection });

export function startWorker(): Worker {
  return new Worker<MessageJobData>(
    "messages",
    async (job: Job<MessageJobData>) => {
      const { from, body, attachmentPath } = job.data;

      // Ensure supplier exists
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

      // Get conversation history
      const history = await getMessageHistory(supplierId);

      // Run AI agent
      const agentResult = await processSupplierMessage(body, parsedText, history);

      // Save extracted offer if present
      if (agentResult.extracted) {
        await saveOffer({
          supplierId,
          documentId: docId,
          offer: agentResult.extracted,
          missingFields: agentResult.missingFields,
        });
      }

      // Send reply
      await sendMessage(from, agentResult.reply);
      await saveMessage(supplierId, "OUT", agentResult.reply);
    },
    {
      connection,
      concurrency: 5,
    }
  );
}
