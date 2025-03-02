import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, "../../.env") });

export const config = {
  AI_API_URL: process.env.AI_API_URL || "http://localhost:40000", // Updated default port
};
