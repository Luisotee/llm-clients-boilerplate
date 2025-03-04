import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file with correct relative path
dotenv.config({ path: path.join(__dirname, "../../../.env") });

export const config = {
  AI_API_URL: process.env.AI_API_URL || "http://localhost:40000",

  // Reaction settings
  reactions: {
    enabled: process.env.ENABLE_REACTIONS === "true",
    emojis: {
      QUEUED: process.env.REACTION_QUEUED || "🔄",
      PROCESSING: process.env.REACTION_PROCESSING || "⏳",
      COMPLETED: process.env.REACTION_COMPLETED || "✅",
      ERROR: process.env.REACTION_ERROR || "❌",
    },
  },
};
