"use client";
import { useEffect, useState } from "react";
import { getMqttClient, topics } from "@/lib/mqtt";

export type Telemetry = {
  Moisture?: number;
  Turbidity?: number;
  R?: number;
  G?: number;
  B?: number;
  ts?: number;
} | null;

/** Tipe minimal klien MQTT yang kita butuhkan */
type MqttLike = {
  subscribe(topic: string, opts: { qos: 0 | 1 | 2 }, cb?: (err?: unknown) => void): void;
  unsubscribe(topic: string, cb?: (err?: unknown) => void): void;
  on(event: "message", cb: (topic: string, payload: Uint8Array) => void): void;
  /** opsional: tidak semua client punya .off */
  off?: (event: "message", cb: (topic: string, payload: Uint8Array) => void) => void;
};

export default function useMqttTelemetry(deviceId?: string | null) {
  const [data, setData] = useState<Telemetry>(null);

  useEffect(() => {
    if (!deviceId) return;

    let mounted = true;
    let clientRef: MqttLike | null = null;
    let topicRef = "";
    let handlerRef: ((topic: string, buf: Uint8Array) => void) | null = null;

    (async () => {
      const client = (await getMqttClient()) as unknown as MqttLike;
      clientRef = client;

      const t = topics.telemetry(deviceId);
      topicRef = t;

      client.subscribe(t, { qos: 0 }, (err) => err && console.error("[MQTT] sub telemetry err:", err));

      handlerRef = (topic: string, buf: Uint8Array) => {
        if (!mounted || topic !== t) return;
        try {
          const s = new TextDecoder().decode(buf);
          const raw = JSON.parse(s) as unknown;
          const j = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

          const toNum = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
          // Terima casing fleksibel: moisture/Moisture, dst.
          const val = (k1: string, k2: string) => toNum(j[k1]) ?? toNum(j[k2]);

          setData({
            Moisture: val("moisture", "Moisture"),
            Turbidity: val("turbidity", "Turbidity"),
            R: val("r", "R"),
            G: val("g", "G"),
            B: val("b", "B"),
            ts: toNum(j["ts"]) ?? Date.now(),
          });
        } catch {
          // abaikan payload yang tidak valid
        }
      };

      client.on("message", handlerRef);
    })();

    return () => {
      mounted = false;
      try {
        if (clientRef && topicRef) {
          // lepas listener jika .off tersedia
          if (clientRef.off && handlerRef) clientRef.off("message", handlerRef);
          clientRef.unsubscribe(topicRef);
        }
      } catch {
        /* no-op */
      }
    };
  }, [deviceId]);

  return data;
}
