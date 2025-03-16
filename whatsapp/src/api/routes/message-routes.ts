import express, { Request, Response } from "express";
import WhatsAppClient from "../../services/whatsapp-client";
import fs from "fs";
import path from "path";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     TextMessage:
 *       type: object
 *       required:
 *         - phoneNumber
 *         - text
 *       properties:
 *         phoneNumber:
 *           type: string
 *           description: The recipient's phone number (with country code, without +)
 *         text:
 *           type: string
 *           description: The message text to send
 *     LocationMessage:
 *       type: object
 *       required:
 *         - phoneNumber
 *         - latitude
 *         - longitude
 *       properties:
 *         phoneNumber:
 *           type: string
 *           description: The recipient's phone number (with country code, without +)
 *         latitude:
 *           type: number
 *           description: Latitude coordinate
 *         longitude:
 *           type: number
 *           description: Longitude coordinate
 *         name:
 *           type: string
 *           description: Optional name of the location
 *         address:
 *           type: string
 *           description: Optional address of the location
 *     ContactMessage:
 *       type: object
 *       required:
 *         - phoneNumber
 *         - contact
 *       properties:
 *         phoneNumber:
 *           type: string
 *           description: The recipient's phone number (with country code, without +)
 *         contact:
 *           type: object
 *           required:
 *             - displayName
 *             - phoneNumber
 *           properties:
 *             displayName:
 *               type: string
 *               description: Contact's display name
 *             phoneNumber:
 *               type: string
 *               description: Contact's phone number
 *             organization:
 *               type: string
 *               description: Optional organization name
 */

/**
 * @swagger
 * /api/messages/text:
 *   post:
 *     summary: Send a text message
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TextMessage'
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */

// @ts-ignore
router.post("/text", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, text } = req.body;

    if (!phoneNumber || !text) {
      return res.status(400).json({ error: "Phone number and text are required" });
    }

    const jid = `${phoneNumber}@s.whatsapp.net`;
    const sock = await WhatsAppClient.getInstance().getSocket();

    const result = await sock.sendMessage(jid, { text });

    if (!result) {
      return res.status(500).json({
        success: false,
        error: "Failed to send message, no response from WhatsApp",
      });
    }

    res.status(200).json({
      success: true,
      messageId: result.key.id,
      message: "Message sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending text message:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send message",
    });
  }
});

/**
 * @swagger
 * /api/messages/media:
 *   post:
 *     summary: Send a media message (image, video, document)
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - attachments
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: The recipient's phone number (with country code, without +)
 *               caption:
 *                 type: string
 *                 description: Optional caption for the media
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Media files to send (images, videos, documents)
 *     responses:
 *       200:
 *         description: Media sent successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */

// @ts-ignore
router.post("/media", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, caption } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!phoneNumber || !files || files.length === 0) {
      return res
        .status(400)
        .json({ error: "Phone number and at least one file are required" });
    }

    const jid = `${phoneNumber}@s.whatsapp.net`;
    const sock = await WhatsAppClient.getInstance().getSocket();
    const file = files[0]; // Process the first file

    // Helper function to determine message type based on mimetype
    const getMessageType = (mimetype: string) => {
      if (mimetype.startsWith("image/")) return "image";
      if (mimetype.startsWith("video/")) return "video";
      if (mimetype.startsWith("audio/")) return "audio";
      return "document";
    };

    const messageType = getMessageType(file.mimetype);
    const fileBuffer = fs.readFileSync(file.path);

    let result;
    switch (messageType) {
      case "image":
        result = await sock.sendMessage(jid, {
          image: fileBuffer,
          caption: caption || undefined,
        });
        break;
      case "video":
        result = await sock.sendMessage(jid, {
          video: fileBuffer,
          caption: caption || undefined,
        });
        break;
      case "audio":
        result = await sock.sendMessage(jid, {
          audio: fileBuffer,
          mimetype: file.mimetype,
        });
        break;
      case "document":
      default:
        result = await sock.sendMessage(jid, {
          document: fileBuffer,
          fileName: file.originalname,
          mimetype: file.mimetype,
          caption: caption || undefined,
        });
        break;
    }

    if (!result) {
      return res.status(500).json({
        success: false,
        error: "Failed to send media, no response from WhatsApp",
      });
    }

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    res.status(200).json({
      success: true,
      messageId: result.key.id,
      message: "Media sent successfully",
      type: messageType,
    });
  } catch (error: any) {
    console.error("Error sending media message:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send media",
    });
  }
});

/**
 * @swagger
 * /api/messages/location:
 *   post:
 *     summary: Send a location message
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LocationMessage'
 *     responses:
 *       200:
 *         description: Location sent successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */

// @ts-ignore
router.post("/location", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, latitude, longitude, name, address } = req.body;

    if (!phoneNumber || latitude === undefined || longitude === undefined) {
      return res
        .status(400)
        .json({ error: "Phone number, latitude, and longitude are required" });
    }

    const jid = `${phoneNumber}@s.whatsapp.net`;
    const sock = await WhatsAppClient.getInstance().getSocket();

    const result = await sock.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: name || undefined,
        address: address || undefined,
      },
    });

    if (!result) {
      return res.status(500).json({
        success: false,
        error: "Failed to send location, no response from WhatsApp",
      });
    }

    res.status(200).json({
      success: true,
      messageId: result.key.id,
      message: "Location sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending location message:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send location",
    });
  }
});

/**
 * @swagger
 * /api/messages/contact:
 *   post:
 *     summary: Send a contact card
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactMessage'
 *     responses:
 *       200:
 *         description: Contact sent successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */

// @ts-ignore
router.post("/contact", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, contact } = req.body;

    if (!phoneNumber || !contact || !contact.displayName || !contact.phoneNumber) {
      return res.status(400).json({
        error: "Phone number, contact name and contact phone number are required",
      });
    }

    const jid = `${phoneNumber}@s.whatsapp.net`;
    const sock = await WhatsAppClient.getInstance().getSocket();

    const vcardName = contact.displayName.replace(/\s/g, "_");
    let vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.displayName}\nTEL;type=CELL;type=VOICE;waid=${contact.phoneNumber}:+${contact.phoneNumber}`;

    if (contact.organization) {
      vcard += `\nORG:${contact.organization}`;
    }

    vcard += `\nEND:VCARD`;

    const result = await sock.sendMessage(jid, {
      contacts: {
        displayName: contact.displayName,
        contacts: [{ vcard }],
      },
    });

    if (!result) {
      return res.status(500).json({
        success: false,
        error: "Failed to send contact, no response from WhatsApp",
      });
    }

    res.status(200).json({
      success: true,
      messageId: result.key.id,
      message: "Contact sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending contact message:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send contact",
    });
  }
});

export default router;
