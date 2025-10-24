import { getMqttClient, topics } from "@/lib/mqtt";

async function publish(topic: string, payload: any) {
  const client = await getMqttClient();
  const msg = typeof payload === "string" ? payload : JSON.stringify(payload);

  return new Promise<void>((resolve, reject) => {
    const send = () => client.publish(topic, msg, { qos: 0, retain: false }, (err) => (err ? reject(err) : resolve()));
    // @ts-ignore
    client.connected ? send() : client.once("connect", send);
    client.once("error", reject);
  });
}

export async function sendStartMeasurement(deviceId: string) {
  return publish(topics.cmd(deviceId), { cmd: "start_measurement", ts: Date.now() });
}

export async function sendStopMeasurement(deviceId: string) {
  return publish(topics.cmd(deviceId), { cmd: "stop_measurement", ts: Date.now() });
}

export async function sendCommand(deviceId: string, cmd: "connect" | "disconnect" | "ping") {
  return publish(topics.cmd(deviceId), { cmd, ts: Date.now() });
}
