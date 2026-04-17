import { encrypt } from "./cryptography";
import axios from "axios";
import Stripe from "stripe";

export interface Config {
  apiUrl: string;
  requestId: string;
  stripeKey: string;
}

export interface LogMessage {
  type: "info" | "error" | "success";
  message: string;
  timestamp: Date;
}

export async function detachStripeCards(
  userId: string,
  config: Config
): Promise<LogMessage[]> {
  const logs: LogMessage[] = [];

  const addLog = (type: LogMessage["type"], message: string) => {
    logs.push({ type, message, timestamp: new Date() });
  };

  try {
    addLog("info", `Starting detachment process for user: ${userId}`);

    const stripeClient = new Stripe(config.stripeKey);
    const packet = encrypt(JSON.stringify({ "X-UID": userId }), config.requestId);

    addLog("info", `Fetching payment methods from Shophelp API...`);

    const response = await axios.get(config.apiUrl, {
      headers: {
        "x-version": packet["x-version"],
        "x-rid": packet["x-rid"],
        "x-timestamp": packet["x-timestamp"].toString(),
        "x-nonce": packet["x-nonce"],
        "x-iv": packet["x-iv"],
        "x-ctext": packet["x-ctext"],
        "x-tag": packet["x-tag"],
      },
    });

    const paymentMethods = response.data;
    addLog("info", `Retrieved ${paymentMethods.length} payment method(s)`);

    for (const paymentMethod of paymentMethods) {
      const paymentMethodId = paymentMethod.stripe_payment_method_id;
      try {
          addLog("info", `Starting detachment for payment method ${paymentMethodId}`);
        await stripeClient.paymentMethods.detach(paymentMethodId);
        addLog("success", `Detached payment method ${paymentMethodId}`);
      } catch (err: any) {
        addLog("error", `Failed to detach ${paymentMethodId}: ${err.message}`);
      }
    }

    addLog("info", `Detachment process completed`);
  } catch (err: any) {
    const errorMsg = err.response
      ? JSON.stringify(err.response.data)
      : err.message;
    addLog("error", `Request error: ${errorMsg}`);
  }

  return logs;
}
