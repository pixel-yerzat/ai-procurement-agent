import { Client, LocalAuth, Message, MessageMedia } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { config } from "../config";

export type IncomingMessageHandler = (
  message: Message,
  attachmentPath?: string
) => Promise<void>;

let client: Client;
let messageHandler: IncomingMessageHandler;
let reconnecting = false;

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

// Kill any leftover Chrome processes that hold our session directory
function killStaleChromeProcesses(): void {
  try {
    // Windows: kill chrome processes silently (ignore errors if none running)
    execSync("taskkill /F /IM chrome.exe /T 2>nul", { stdio: "ignore" });
  } catch {
    // No Chrome running — that's fine
  }
}

// Chrome creates three Singleton* lock files — delete all of them
function clearSessionLocks(): void {
  const sessionDir = path.join(config.whatsapp.sessionPath, "session");
  if (!fs.existsSync(sessionDir)) return;

  const locks = ["SingletonLock", "SingletonSocket", "SingletonCookie"];
  for (const lock of locks) {
    const p = path.join(sessionDir, lock);
    try {
      if (fs.existsSync(p)) {
        fs.rmSync(p);
        console.log(`[WhatsApp] Removed stale lock: ${lock}`);
      }
    } catch {
      // non-fatal
    }
  }
}

async function createClient(): Promise<void> {
  if (reconnecting) return;
  reconnecting = true;

  killStaleChromeProcesses();
  clearSessionLocks();

  // Brief pause so OS releases file handles after kill
  await new Promise((r) => setTimeout(r, 1000));

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.whatsapp.sessionPath,
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", (qr) => {
    console.log("\n[WhatsApp] Scan QR code to log in:\n");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    reconnecting = false;
    console.log("[WhatsApp] Connected and ready");

    // pupPage is only available after ready — attach page close listener here
    client.pupPage?.on("close", () => {
      console.warn("[WhatsApp] Browser page closed — reconnecting in 5s...");
      scheduleReconnect();
    });
  });

  client.on("auth_failure", (msg) => {
    reconnecting = false;
    console.error("[WhatsApp] Auth failure:", msg);
  });

  client.on("disconnected", (reason) => {
    console.warn("[WhatsApp] Disconnected:", reason, "— reconnecting in 5s...");
    client.destroy().catch(() => null).finally(() => scheduleReconnect());
  });

  client.on("message", async (message: Message) => {
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

  try {
    await client.initialize();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    reconnecting = false;
    if (msg.includes("already running")) {
      console.warn("[WhatsApp] Chrome still running after kill — retrying in 5s...");
      scheduleReconnect();
    } else {
      throw err;
    }
  }
}

function scheduleReconnect(): void {
  reconnecting = false;
  setTimeout(() => createClient(), 5000);
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
      console.warn(`[WhatsApp] Detached frame on send, retry ${attempt}/3 in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
      return sendMessage(to, text, attempt + 1);
    }
    throw err;
  }
}
