"use client";

import { useEffect } from "react";
import { getMqttClient, topics } from "@/lib/mqtt";
import { getStoredUser } from "@/services/appAuth";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function MqttBridge() {
  useEffect(() => {
    let mounted = true;

    (async () => {
      const u = getStoredUser();
      const deviceId = u?.deviceId;
      if (!u?.id || !deviceId) return;

      const client = await getMqttClient();
      if (!mounted) return;

      const tStatus = topics.status(deviceId);
      client.subscribe([tStatus], { qos: 0 }, (err) => err && console.error("[MQTT] subscribe error:", err));

      client.on("message", async (topic, payloadBuf) => {
        if (topic !== tStatus) return;
        try {
          const s = new TextDecoder().decode(payloadBuf);
          let connected = false;
          if (s === "online") connected = true;
          else if (s === "offline") connected = false;
          else {
            try {
              const j = JSON.parse(s);
              connected = !!(j.status ?? j.connected);
            } catch {}
          }

          await updateDoc(doc(db, "devices", deviceId), {
            status: connected,
            last_update: serverTimestamp(),
          });
        } catch (e) {
          console.error("[MQTT] message handle error:", e);
        }
      });
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
