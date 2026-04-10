// Pipedream webhook integration
// Sends events from MarketPlan to the Pipedream workflow for automation & logging

const PIPEDREAM_URL = "https://eo25iidnjf3m2wa.m.pipedream.net";

export interface WebhookEvent {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Fire-and-forget webhook dispatch.
 * Never throws — logs errors but does not block the caller.
 */
export async function sendWebhook(
  event: string,
  data: Record<string, any>
): Promise<void> {
  const payload: WebhookEvent = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const res = await fetch(PIPEDREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log(
      `Webhook [${event}] → Pipedream ${res.status} ${res.statusText}`
    );
  } catch (err) {
    // Never fail the main flow because of a webhook issue
    console.log(`Webhook [${event}] error (non-blocking): ${err}`);
  }
}
