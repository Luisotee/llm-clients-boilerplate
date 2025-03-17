import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file with correct relative path
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Debug logging to help identify environment variable issues
console.log("Environment variables:", {
  AI_API_URL: process.env.AI_API_URL,
  ENABLE_REACTIONS: process.env.ENABLE_REACTIONS,
  REACTION_QUEUED: process.env.REACTION_QUEUED,
});

export const config = {
  AI_API_URL: process.env.AI_API_URL || "http://localhost:40000",

  // Reaction settings
  reactions: {
    enabled: process.env.ENABLE_REACTIONS === "true",
    emojis: {
      QUEUED: process.env.REACTION_QUEUED || "🔄",
      PROCESSING: process.env.REACTION_PROCESSING || "⚙️", // Match your .env value
      COMPLETED: process.env.REACTION_COMPLETED || "✅",
      ERROR: process.env.REACTION_ERROR || "⚠️", // Match your .env value
    },
  },
};

// Debug the config after construction
console.log("Config loaded:", {
  apiUrl: config.AI_API_URL,
  reactionsEnabled: config.reactions.enabled,
  reactions: config.reactions.emojis,
});
