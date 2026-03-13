import { Status } from "@/common/types/status.type";

export interface Client {
  deviceId: string;
  pcNo: number;
  status: Status;
  startAt: number;
  remainingSeconds: number;
  lastSeen: number;
}
