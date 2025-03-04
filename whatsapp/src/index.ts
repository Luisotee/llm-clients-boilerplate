import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import { config } from "./config/config";
import { enqueueMessage, getQueueSize } from "./services/message-queue";
import * as fs from "fs";

const SESSION_DIR = "./auth_info";

// Create session directory if it doesn't exist
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Get reaction settings from config
const REACTIONS_ENABLED = config.reactions.enabled;
const REACTIONS = config.reactions.emojis;

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
            const jid = msg.key.remoteJid || null; // Ensure jid is string | null, not undefined
            const senderJid = msg.key.participant || jid || "";

            // Use senderJid as the unique identifier for the user
            const userId = senderJid;

            console.log(`New message from ${userId}: ${conversation}`);

            try {
              // Check if this message will be queued (not processed immediately)
              const queueSize = getQueueSize(userId);

              // If this is the first message or the queue is empty,
              // show processing reaction immediately
              if (queueSize === 0 && jid && REACTIONS_ENABLED) {
                await sock.sendMessage(jid, {
                  react: {
                    text: REACTIONS.PROCESSING,
                    key: msg.key,
                  },
                });
              }
              // For queued messages, the reaction will be set in enqueueMessage

              // Add to queue and process
              const conversationId = `whatsapp_${userId}`;
              const response = await enqueueMessage(
                userId,
                conversation,
                conversationId,
                msg.key,
                jid, // Now jid is definitely string | null
                sock
              );

              // Change reaction to "completed" if enabled
              if (jid) {
                if (REACTIONS_ENABLED) {
                  await sock.sendMessage(jid, {
                    react: {
                      text: REACTIONS.COMPLETED,
                      key: msg.key,
                    },
                  });
                }

                // Reply to the message with quoting (as third parameter)
                await sock.sendMessage(
                  jid,
                  { text: response },
                  { quoted: msg } // The quoting is now correctly in the options parameter
                );
              }
            } catch (error) {
              console.error("Error processing message:", error);

              // Change reaction to "error" if enabled
              if (jid) {
                if (REACTIONS_ENABLED) {
                  await sock.sendMessage(jid, {
                    react: {
                      text: REACTIONS.ERROR,
                      key: msg.key,
                    },
                  });
                }

                // Error reply also quotes the original message
                await sock.sendMessage(
                  jid,
                  { text: "I'm sorry, I couldn't process your message at the moment." },
                  { quoted: msg } // The quoting is now correctly in the options parameter
                );
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
