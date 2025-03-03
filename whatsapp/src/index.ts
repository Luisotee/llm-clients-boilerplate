import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import { processMessage } from "./services/api";
import { config } from "./config/config";
import * as fs from "fs";

const SESSION_DIR = "./auth_info";

// Create session directory if it doesn't exist
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  });

  // Save credentials whenever updated
  sock.ev.on("creds.update", saveCreds);

  // Handle connection updates
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("QR Code: ");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log(
        "Connection closed due to ",
        lastDisconnect?.error,
        ", reconnecting: ",
        shouldReconnect
      );

      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      console.log("Connection opened");
    }
  });

  // Handle incoming messages
  sock.ev.on("messages.upsert", async (m) => {
    if (m.type === "notify") {
      for (const msg of m.messages) {
        if (!msg.key.fromMe && msg.message) {
          const conversation =
            msg.message.conversation || msg.message.extendedTextMessage?.text || "";

          if (conversation) {
            const jid = msg.key.remoteJid;
            const senderJid = msg.key.participant || jid || "";

            console.log(`New message from ${senderJid}: ${conversation}`);

            try {
              // Process message with AI service
              const conversationId = `whatsapp_${senderJid}`;
              const response = await processMessage(conversation, conversationId);

              // Reply to the message
              if (jid) {
                await sock.sendMessage(jid, { text: response });
              }
            } catch (error) {
              console.error("Error processing message:", error);
              if (jid) {
                await sock.sendMessage(jid, {
                  text: "I'm sorry, I couldn't process your message at the moment.",
                });
              }
            }
          }
        }
      }
    }
  });
}

// Start WhatsApp connection
connectToWhatsApp().catch((err) => console.log("Unexpected error: ", err));
