// src/lib/mqtt.ts
import type { MqttClient } from "mqtt";

export type MqttOpts = { url?: string; clientId?: string; username?: string; password?: string };

function ensureWsUrlWithPath(raw?: string): string {
  if (!raw) throw new Error("MQTT URL not provided");
  if (!(raw.startsWith("ws://") || raw.startsWith("wss://"))) throw new Error(`Use WebSocket URL (ws:// or wss://). Got "${raw}"`);

  try {
    const u = new URL(raw);
    if (!u.pathname || u.pathname === "/") u.pathname = "/mqtt";
    if (u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return raw.endsWith("/mqtt") ? raw : raw.replace(/\/?$/, "/mqtt");
  }
}

let clientPromise: Promise<MqttClient> | null = null;

export async function getMqttClient(opts: MqttOpts = {}): Promise<MqttClient> {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const { default: mqtt } = await import("mqtt");
    const url = ensureWsUrlWithPath(opts.url || process.env.NEXT_PUBLIC_MQTT_URL_PRIVATE);

    const clientId = opts.clientId || `pamits-web-${Math.random().toString(16).slice(2)}`;
    const username = opts.username || process.env.NEXT_PUBLIC_MQTT_USERNAME || undefined;
    const password = opts.password || process.env.NEXT_PUBLIC_MQTT_PASSWORD || undefined;

    const client = mqtt.connect(url, {
      clientId,
      clean: true,
      keepalive: 60,
      reconnectPeriod: 3000,
      connectTimeout: 20_000,
      username,
      password,
      protocolVersion: 4,
      will: { topic: "pamits/web/lastwill", payload: JSON.stringify({ clientId, ts: Date.now() }), qos: 0, retain: false },
    });

    client.on("connect", () => console.log("[MQTT] connected →", url, clientId));
    client.on("reconnect", () => console.log("[MQTT] reconnecting…"));
    client.on("close", () => console.log("[MQTT] closed"));
    client.on("end", () => console.log("[MQTT] ended"));
    client.on("error", (e) => console.error("[MQTT] error:", e?.message || e));
    return client;
  })();

  return clientPromise;
}

export const topics = {
  status: (id: string) => `mqtt_lukmankh/devices/${id}/status`, // device → web (retained)
  telemetry: (id: string) => `mqtt_lukmankh/devices/${id}/telemetry`, // device → web (live)
  cmd: (id: string) => `mqtt_lukmankh/devices/${id}/cmd`, // web → device
};
