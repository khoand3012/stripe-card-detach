import type { NextApiRequest, NextApiResponse } from "next";
import { detachStripeCards } from "../../services/detach";
import type { Config, LogMessage } from "../../services/detach";

interface DetachRequestBody {
  userId?: string;
  config?: Partial<Config>;
}

interface DetachResponse {
  logs: LogMessage[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DetachResponse | { error: string }>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, config }: DetachRequestBody = req.body ?? {};

  if (!userId || !userId.trim()) {
    return res.status(400).json({ error: "Device ID is required" });
  }

  const resolvedConfig: Config = {
    apiUrl: config?.apiUrl || "",
    requestId: config?.requestId || "",
    stripeKey: config?.stripeKey || "",
  };

  if (
    !resolvedConfig.apiUrl ||
    !resolvedConfig.requestId ||
    !resolvedConfig.stripeKey
  ) {
    return res.status(400).json({
      error: "API endpoint, request ID, and Stripe secret key are required",
    });
  }

  const logs = await detachStripeCards(userId.trim(), resolvedConfig);
  return res.status(200).json({ logs });
}
