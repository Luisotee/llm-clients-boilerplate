import * as fs from "fs";
import { config } from "./config/config";
import { startServer } from "./api/server";
import WhatsAppClient from "./services/whatsapp-client";
import { enqueueMessage, getQueueSize } from "./services/message-queue";

const SESSION_DIR = "./auth_info";

// Create session directory if it doesn't exist
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Get reaction settings from config
const REACTIONS_ENABLED = config.reactions.enabled;
const REACTIONS = config.reactions.emojis;

async function startWhatsAppClient() {
  try {
    // Get the WhatsApp client instance
    const whatsappClient = WhatsAppClient.getInstance();
    const sock = await whatsappClient.getSocket();

    // Handle incoming messages
    sock.ev.on("messages.upsert", async (m) => {
      if (m.type === "notify") {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            const conversation =
              msg.message.conversation || msg.message.extendedTextMessage?.text || "";

            if (conversation) {
              const jid = msg.key.remoteJid || null;
              const senderJid = msg.key.participant || jid || "";

              // Use senderJid as the unique identifier for the user
              const userId = senderJid;

              console.log(`New message from ${userId}: ${conversation}`);

              try {
                // Check if this message will be queued (not processed immediately)
                const queueSize = getQueueSize(userId);
                console.log(`Queue size for ${userId}: ${queueSize}`);

                // If this is the first message or the queue is empty,
                // show processing reaction immediately
                if (queueSize === 0 && jid && REACTIONS_ENABLED) {
                  try {
                    await sock.sendMessage(jid, {
                      react: {
                        text: REACTIONS.PROCESSING,
                        key: msg.key,
                      },
                    });
                  } catch (reactionError) {
                    console.error("Error sending processing reaction:", reactionError);
                  }
                }
                // For queued messages, the reaction will be set in enqueueMessage

                // Add to queue and process
                const conversationId = `whatsapp_${userId.replace(
                  "@s.whatsapp.net",
                  ""
                )}`;
                const response = await enqueueMessage(
                  userId,
                  conversation,
                  conversationId,
                  msg.key,
                  jid,
                  sock
                );

                // Change reaction to "completed" if enabled
                if (jid) {
                  if (REACTIONS_ENABLED) {
                    try {
                      await sock.sendMessage(jid, {
                        react: {
                          text: REACTIONS.COMPLETED,
                          key: msg.key,
                        },
                      });
                    } catch (reactionError) {
                      console.error("Error sending completed reaction:", reactionError);
                    }
                  }

                  // Reply to the message with quoting
                  await sock.sendMessage(jid, { text: response }, { quoted: msg });
                }
              } catch (error) {
                console.error("Error processing message:", error);

                // Change reaction to "error" if enabled
                if (jid) {
                  if (REACTIONS_ENABLED) {
                    try {
                      await sock.sendMessage(jid, {
                        react: {
                          text: REACTIONS.ERROR,
                          key: msg.key,
                        },
                      });
                    } catch (reactionError) {
                      console.error("Error sending error reaction:", reactionError);
                    }
                  }

                  // Error reply also quotes the original message
                  await sock.sendMessage(
                    jid,
                    { text: "I'm sorry, I couldn't process your message at the moment." },
                    { quoted: msg }
                  );
                }
              }
            }
          }
        }
      }
    });

    console.log("WhatsApp client initialized successfully");
  } catch (err) {
    console.error("Error starting WhatsApp client:", err);
  }
}

// Start both the WhatsApp client and API server
async function start() {
  try {
    // Start the WhatsApp client
    await startWhatsAppClient();

    // Start the API server
    startServer();
  } catch (err) {
    console.error("Failed to start:", err);
  }
}

// Start the application
start().catch((err) => console.error("Unexpected error:", err));
