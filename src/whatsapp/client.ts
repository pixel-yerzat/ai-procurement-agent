import { Client, LocalAuth, Message, MessageMedia } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import path from "path";
import fs from "fs";
import { config } from "../config";

export type IncomingMessageHandler = (
  message: Message,
  attachmentPath?: string
) => Promise<void>;

let client: Client;

export function getClient(): Client {
  if (!client) throw new Error("WhatsApp client not initialized");
  return client;
}

export async function initWhatsApp(
  onMessage: IncomingMessageHandler
): Promise<void> {
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.whatsapp.sessionPath,
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    console.log("\n[WhatsApp] Scan QR code to log in:\n");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("[WhatsApp] Client ready");
  });

  client.on("auth_failure", (msg) => {
    console.error("[WhatsApp] Auth failure:", msg);
  });

  client.on("message", async (message: Message) => {
    let attachmentPath: string | undefined;

    if (message.hasMedia) {
      try {
        attachmentPath = await downloadAttachment(message);
      } catch (err) {
        console.error("[WhatsApp] Failed to download attachment:", err);
      }
    }

    await onMessage(message, attachmentPath);
  });

  await client.initialize();
}

async function downloadAttachment(message: Message): Promise<string> {
  const media: MessageMedia = await message.downloadMedia();
  const ext = media.mimetype.split("/")[1]?.split(";")[0] ?? "bin";
  const filename = `${Date.now()}_${message.from}.${ext}`;
  const destDir = path.join("sessions", "attachments");
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, filename);
  fs.writeFileSync(destPath, Buffer.from(media.data, "base64"));
  return destPath;
}

export async function sendMessage(to: string, text: string): Promise<void> {
  await getClient().sendMessage(to, text);
}
