import type { MqttClient } from "mqtt";
import { getMqttClient, topics } from "@/lib/mqtt";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function publishOnce(client: MqttClient, topic: string, payload: Json) {
  const msg = typeof payload === "string" ? payload : JSON.stringify(payload);
  return new Promise<void>((resolve, reject) => {
    const send = () => client.publish(topic, msg, { qos: 0, retain: false }, (err?: Error) => (err ? reject(err) : resolve()));

    if (client.connected) send();
    else client.once("connect", send);

    client.once("error", reject);
  });
}

export async function sendStartMeasurement(deviceId: string) {
  const client = await getMqttClient();
  return publishOnce(client, topics.cmd(deviceId), { cmd: "start_measurement", ts: Date.now() });
}

export async function sendStopMeasurement(deviceId: string) {
  const client = await getMqttClient();
  return publishOnce(client, topics.cmd(deviceId), { cmd: "stop_measurement", ts: Date.now() });
}

export async function sendCommand(deviceId: string, cmd: "connect" | "disconnect" | "ping") {
  const client = await getMqttClient();
  return publishOnce(client, topics.cmd(deviceId), { cmd, ts: Date.now() });
}
