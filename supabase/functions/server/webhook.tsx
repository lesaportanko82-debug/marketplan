// Внешние вебхуки (Pipedream) отключены: данные пользователей никуда не отправляются.
export interface WebhookEvent {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

export async function sendWebhook(_event: string, _data: Record<string, any>): Promise<void> {
  // no-op
}
