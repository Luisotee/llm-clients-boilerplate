import express from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import bodyParser from "body-parser";
import multer from "multer";
import path from "path";
import fs from "fs";
import { config } from "../config/config";
import cors from "cors";

// Import routes
import messageRoutes from "./routes/message-routes";

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`);
  },
});

// Create Express app
const app = express();
const port = process.env.API_PORT || 40001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer({ storage }).array("attachments"));
app.use("/uploads", express.static(uploadsDir));

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WhatsApp API",
      version: "1.0.0",
      description: "API for sending WhatsApp messages",
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: "Local server",
      },
    ],
  },
  apis: ["./src/api/routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Routes
app.use("/api/messages", messageRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root route
app.get("/", (req, res) => {
  res.send("WhatsApp API is running. Visit /api-docs for documentation.");
});

// Start server function
export const startServer = () => {
  return app.listen(port, () => {
    console.log(`⚡️ API Server running at http://localhost:${port}`);
    console.log(
      `📚 Swagger documentation available at http://localhost:${port}/api-docs`
    );
  });
};
