import { Client } from "@/common/types/client.type";
import { WSContext } from "hono/ws";

interface ServerClient extends Client {
  ws: WSContext<WebSocket>;
}

export const clients = new Map<string, ServerClient>();
