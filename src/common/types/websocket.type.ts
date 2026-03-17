import { WSContext } from "hono/ws";

export interface CustomWebscoket extends WSContext<WebSocket> {
  deviceId?: string;
}
