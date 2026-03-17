export const DeviceSessionStatus = {
  Pending: "pending",
  Active: "active",
  Expired: "expired",
  Terminated: "terminated",
} as const;

export type DeviceSessionStatus =
  (typeof DeviceSessionStatus)[keyof typeof DeviceSessionStatus];
