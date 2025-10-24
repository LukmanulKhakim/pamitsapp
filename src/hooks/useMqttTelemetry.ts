"use client";
import { useEffect, useState } from "react";
import { getMqttClient, topics } from "@/lib/mqtt";

export type Telemetry = {
  FFA?: number;
  Carotine?: number;
  Moisture?: number;
  result?: boolean;
  ts?: number;
} | null;

export default function useMqttTelemetry(deviceId?: string | null) {
  const [data, setData] = useState<Telemetry>(null);

  useEffect(() => {
    if (!deviceId) return;
    let mounted = true;

    (async () => {
      const client = await getMqttClient();
      const t = topics.telemetry(deviceId);
      client.subscribe(t, { qos: 0 }, (err) => err && console.error("[MQTT] sub telemetry err:", err));

      const handler = (topic: string, buf: Uint8Array) => {
        if (topic !== t || !mounted) return;
        try {
          const s = new TextDecoder().decode(buf);
          const j = JSON.parse(s);
          setData({
            FFA: j.ffa ?? j.FFA,
            Carotine: j.carotine ?? j.Carotine,
            Moisture: j.moisture ?? j.Moisture,
            result: j.result,
            ts: j.ts ?? Date.now(),
          });
        } catch {}
      };

      client.on("message", handler);
    })();

    return () => {
      mounted = false;
    };
  }, [deviceId]);

  return data;
}
