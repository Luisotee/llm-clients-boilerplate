import { processMessage } from "./api";
import { config } from "../config/config";
import { WASocket } from "@whiskeysockets/baileys";

// Types
type QueuedMessage = {
  resolve: (value: string | PromiseLike<string>) => void;
  reject: (reason?: any) => void;
  message: string;
  conversationId: string;
  messageKey: any; // Store message key for reactions
  jid: string | null; // Store jid for sending reactions
  sock: WASocket; // Store socket instance for sending reactions
};

// Queue state
const queues: Map<string, QueuedMessage[]> = new Map();
const processing: Map<string, boolean> = new Map();

// Get reaction settings
const REACTIONS_ENABLED = config.reactions.enabled;
const REACTIONS = config.reactions.emojis;

/**
 * Enqueues a message for processing for a specific user
 */
export async function enqueueMessage(
  userId: string,
  message: string,
  conversationId: string,
  messageKey: any,
  jid: string | null,
  sock: WASocket
): Promise<string> {
  console.log(`Enqueueing message for user ${userId}: ${message.substring(0, 20)}...`);

  // Check if the queue is being processed or has messages
  const isProcessing = processing.get(userId) || false;
  const existingQueueLength = queues.get(userId)?.length || 0;

  console.log(
    `Queue status for ${userId}: processing=${isProcessing}, queueLength=${existingQueueLength}`
  );

  // Show QUEUED if the queue is being processed OR has existing messages
  if ((isProcessing || existingQueueLength > 0) && jid && REACTIONS_ENABLED) {
    await sock.sendMessage(jid, {
      react: {
        text: REACTIONS.QUEUED,
        key: messageKey,
      },
    });
  }

  return new Promise<string>((resolve, reject) => {
    // Create a queued message object
    const queuedMessage: QueuedMessage = {
      resolve,
      reject,
      message,
      conversationId,
      messageKey,
      jid,
      sock,
    };

    // Get or create the queue for this user
    const userQueue = queues.get(userId) || [];
    userQueue.push(queuedMessage);
    queues.set(userId, userQueue);

    // Start processing the queue if it's not already being processed
    if (!processing.get(userId)) {
      processQueue(userId);
    }
  });
}

/**
 * Processes all messages in a user's queue
 */
async function processQueue(userId: string): Promise<void> {
  // Mark this user's queue as being processed
  processing.set(userId, true);

  try {
    // Process all messages in the queue
    while (hasMessages(userId)) {
      const queuedMessage = getNextMessage(userId);

      if (!queuedMessage) break;

      console.log(
        `Processing message for user ${userId}: ${queuedMessage.message.substring(
          0,
          20
        )}...`
      );

      // Set processing reaction
      if (queuedMessage.jid && REACTIONS_ENABLED) {
        await queuedMessage.sock.sendMessage(queuedMessage.jid, {
          react: {
            text: REACTIONS.PROCESSING,
            key: queuedMessage.messageKey,
          },
        });
      }

      try {
        // Process the message
        const response = await processMessage(
          queuedMessage.message,
          queuedMessage.conversationId
        );

        // Resolve the promise with the response
        queuedMessage.resolve(response);
      } catch (error) {
        console.error(`Error processing message for user ${userId}:`, error);
        queuedMessage.reject(error);
      }

      // Add a small delay between processing messages to ensure reactions are visible
      // This helps when messages come in very quickly
      if (hasMessages(userId)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } finally {
    // Mark this user's queue as no longer being processed
    processing.set(userId, false);

    // Check if new messages were added while processing
    if (hasMessages(userId)) {
      processQueue(userId);
    }
  }
}

/**
 * Checks if a user has messages in their queue
 */
function hasMessages(userId: string): boolean {
  const userQueue = queues.get(userId);
  return !!userQueue && userQueue.length > 0;
}

/**
 * Gets the next message for a user and removes it from the queue
 */
function getNextMessage(userId: string): QueuedMessage | undefined {
  const userQueue = queues.get(userId);
  if (!userQueue || userQueue.length === 0) {
    return undefined;
  }

  // Get the next message and remove it from the queue
  const nextMessage = userQueue.shift();
  queues.set(userId, userQueue);

  return nextMessage;
}

/**
 * Returns the current queue size for a user
 */
export function getQueueSize(userId: string): number {
  const userQueue = queues.get(userId);
  return userQueue ? userQueue.length : 0;
}
