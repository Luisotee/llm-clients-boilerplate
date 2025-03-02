import { config } from "../config/config";

export async function processMessage(
  content: string,
  conversationId: string
): Promise<string> {
  try {
    // Create URLSearchParams object directly
    const formData = new URLSearchParams();
    formData.append("content", content);
    formData.append("platform", "whatsapp");
    formData.append("platform_user_id", conversationId);

    if (conversationId) {
      formData.append("conversation_id", conversationId);
    }

    const response = await fetch(`${config.AI_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API responded with status: ${response.status}, ${errorText}`);
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error("Error calling AI API:", error);
    throw error;
  }
}
