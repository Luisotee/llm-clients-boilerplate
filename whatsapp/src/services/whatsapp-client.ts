import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import * as fs from "fs";

const SESSION_DIR = "./auth_info";

// Create session directory if it doesn't exist
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

class WhatsAppClient {
  private static instance: WhatsAppClient;
  private socket: WASocket | null = null;
  private isConnecting: boolean = false;
  private connectionPromise: Promise<WASocket> | null = null;

  private constructor() {}

  public static getInstance(): WhatsAppClient {
    if (!WhatsAppClient.instance) {
      WhatsAppClient.instance = new WhatsAppClient();
    }
    return WhatsAppClient.instance;
  }

  public async getSocket(): Promise<WASocket> {
    if (this.socket) return this.socket;

    if (this.isConnecting) {
      // If already connecting, return the promise
      return this.connectionPromise!;
    }

    // Start connecting
    this.isConnecting = true;
    this.connectionPromise = this.initializeConnection();

    try {
      this.socket = await this.connectionPromise;
      return this.socket;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  private async initializeConnection(): Promise<WASocket> {
    console.log("Initializing WhatsApp connection...");

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state,
    });

    // Save credentials whenever updated
    sock.ev.on("creds.update", saveCreds);

    // Handle connection updates
    return new Promise((resolve, reject) => {
      const connectionHandler = async (update: any) => {
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
            // Reset socket so it will reconnect on next getSocket() call
            this.socket = null;
            reject(new Error("Connection closed, please try again"));
          } else {
            reject(new Error("Logged out"));
          }

          // Remove the event listener
          sock.ev.off("connection.update", connectionHandler);
        } else if (connection === "open") {
          console.log("Connection opened");
          resolve(sock);

          // Remove the event listener after successful connection
          sock.ev.off("connection.update", connectionHandler);
        }
      };

      // Set up the connection handler
      sock.ev.on("connection.update", connectionHandler);
    });
  }
}

export default WhatsAppClient;
