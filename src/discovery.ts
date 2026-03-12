import dgram from "node:dgram";

const DISCOVERY_PORT = 5001;

export const startDiscoveryServer = () => {
  const server = dgram.createSocket("udp4");

  server.on("message", (msg, rinfo) => {
    if (msg.toString() === "DISCOVER_TIMER_SERVER") {
      server.send(Buffer.from("TIMER_SERVER"), rinfo.port, rinfo.address);
    }
  });

  server.bind(DISCOVERY_PORT, () =>
    console.log("UDP discovery server listening on port 5001"),
  );
};
