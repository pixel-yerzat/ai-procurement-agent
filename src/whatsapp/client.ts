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
let messageHandler: IncomingMessageHandler;

export function getClient(): Client {
  if (!client) throw new Error("WhatsApp client not initialized");
  return client;
}

export async function initWhatsApp(
  onMessage: IncomingMessageHandler
): Promise<void> {
  messageHandler = onMessage;
  await createClient();
}

async function createClient(): Promise<void> {
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.whatsapp.sessionPath,
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  client.on("qr", (qr) => {
    console.log("\n[WhatsApp] Scan QR code to log in:\n");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("[WhatsApp] Connected and ready");
  });

  client.on("auth_failure", (msg) => {
    console.error("[WhatsApp] Auth failure:", msg);
  });

  client.on("disconnected", (reason) => {
    console.warn("[WhatsApp] Disconnected:", reason, "— reconnecting in 5s...");
    client.destroy().catch(() => null).finally(() => {
      setTimeout(() => createClient(), 5000);
    });
  });

  // Puppeteer page can be destroyed on WhatsApp Web reload — trigger reconnect
  client.pupPage?.on("close", () => {
    console.warn("[WhatsApp] Browser page closed — reconnecting in 5s...");
    setTimeout(() => createClient(), 5000);
  });

  client.on("message", async (message: Message) => {
    // Ignore group messages and status broadcasts
    if (message.from === "status@broadcast") return;

    let attachmentPath: string | undefined;

    if (message.hasMedia) {
      try {
        attachmentPath = await downloadAttachment(message);
      } catch (err) {
        console.error("[WhatsApp] Failed to download attachment:", err);
      }
    }

    try {
      await messageHandler(message, attachmentPath);
    } catch (err) {
      console.error("[WhatsApp] Handler error:", err);
    }
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

const DETACHED_FRAME_RE = /detached\s+frame/i;

export async function sendMessage(
  to: string,
  text: string,
  attempt = 1
): Promise<void> {
  try {
    await getClient().sendMessage(to, text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (DETACHED_FRAME_RE.test(msg) && attempt < 4) {
      // Frame was destroyed — wait for the page to settle, then retry
      console.warn(`[WhatsApp] Detached frame on send, retry ${attempt}/3 in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
      return sendMessage(to, text, attempt + 1);
    }
    throw err;
  }
}
