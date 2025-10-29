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

export default function useMqttTelemetry(deviceId?: string | null) {
  const [data, setData] = useState<Telemetry>(null);

  useEffect(() => {
    if (!deviceId) return;
    let mounted = true;
    let clientRef: any;
    let topicRef = "";

    (async () => {
      const client = await getMqttClient();
      clientRef = client;

      const t = topics.telemetry(deviceId);
      topicRef = t;

      client.subscribe(t, { qos: 0 }, (err) => err && console.error("[MQTT] sub telemetry err:", err));

      const handler = (topic: string, buf: Uint8Array) => {
        if (!mounted || topic !== t) return;
        try {
          const s = new TextDecoder().decode(buf);
          const j = JSON.parse(s);

          // Terima casing fleksibel: moisture/Moisture, dst.
          const val = (k1: string, k2: string) => (typeof j[k1] === "number" ? j[k1] : typeof j[k2] === "number" ? j[k2] : undefined);

          setData({
            Moisture: val("moisture", "Moisture"),
            Turbidity: val("turbidity", "Turbidity"),
            R: val("r", "R"),
            G: val("g", "G"),
            B: val("b", "B"),
            ts: typeof j.ts === "number" ? j.ts : Date.now(),
          });
        } catch {
          // ignore broken payload
        }
      };

      client.on("message", handler);

      // cleanup: lepas listener & unsubscribe topic
      const cleanup = () => {
        try {
          client.off?.("message", handler);
          client.unsubscribe?.(t);
        } catch {
          /* no-op */
        }
      };

      // simpan ke ref untuk dipakai di return cleanup
      (useMqttTelemetry as any)._cleanup = cleanup;
    })();

    return () => {
      mounted = false;
      try {
        const cleanup = (useMqttTelemetry as any)._cleanup as (() => void) | undefined;
        cleanup?.();
        // fallback jika _cleanup tidak terpasang
        if (clientRef && topicRef) {
          clientRef.off?.("message");
          clientRef.unsubscribe?.(topicRef);
        }
      } catch {
        /* no-op */
      }
    };
  }, [deviceId]);

  return data;
}
