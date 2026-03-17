import { WSContext } from "hono/ws";

export interface Client {
  id: string;
  ws: WSContext<WebSocket>;
}
