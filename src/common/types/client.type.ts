import { Status } from "@/common/types/status.type";

export interface Client {
  deviceId: string;
  pcNo: number;
  status: Status;
  startAt: number | null;
  endAt: number | null;
  remainingSeconds: number;
  lastSeen: number;
}
