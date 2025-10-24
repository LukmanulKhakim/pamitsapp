"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getStoredUser, normalizeDeviceId, type AppUser } from "@/services/appAuth";
import { sendCommand } from "@/services/mqttCommands";

type DeviceDoc = { status?: boolean | null };

type DeviceState = {
  id: string | null;
  connected: boolean | null; // null = loading/unknown
};

export default function StatusCard({ className = "" }: { className?: string }) {
  const [device, setDevice] = useState<DeviceState>({
    id: null,
    connected: null,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // state untuk indikator "menunggu konfirmasi" dari device
  const [pendingTarget, setPendingTarget] = useState<boolean | null>(null);

  useEffect(() => {
    const cached: AppUser | null = getStoredUser();
    if (!cached?.id) return;

    const devId = normalizeDeviceId(cached.deviceId ?? null);
    if (!devId) {
      setDevice({ id: null, connected: null });
      return;
    }

    // Listen Firestore device -> ini akan berubah saat MqttBridge menulis status online/offline
    const unsub = onSnapshot(doc(db, "devices", devId), (snap) => {
      if (!snap.exists()) {
        setDevice({ id: devId, connected: null });
        return;
      }
      const data = snap.data() as DeviceDoc;
      const status = typeof data.status === "boolean" ? data.status : null;

      setDevice(() => {
        const next = { id: devId, connected: status };
        // jika sudah menerima konfirmasi dan status = target, hapus "pending"
        if (pendingTarget !== null && status === pendingTarget) {
          setPendingTarget(null);
        }
        return next;
      });
    });

    return () => unsub();
  }, [pendingTarget]);

  const isConnected = device.connected === true;

  const gradient = "from-lime-400 to-yellow-300 text-black"; // konsisten desain

  async function onToggle(next: boolean) {
    if (!device.id || busy || device.connected === null) return;

    try {
      setBusy(true);
      setErr(null);
      setPendingTarget(next);

      //console.log("[StatusCard] sendCommand", device.id, next ? "connect" : "disconnect");

      await sendCommand(device.id, next ? "connect" : "disconnect");

      // Tunggu device publish status → MqttBridge yang update Firestore
    } catch (e) {
      //console.error("[StatusCard] sendCommand error:", e);
      setErr(e instanceof Error ? e.message : "Failed to send command");
      setPendingTarget(null);
    } finally {
      setBusy(false);
    }
  }

  const badge = device.connected === null ? "border-yellow-600 bg-yellow-300" : isConnected ? "border-green-700 bg-lime-400" : "border-red-700 bg-red-500";
  const badgeIcon = device.connected === null ? "…" : isConnected ? "✅" : "✖";

  const disabled = !device.id || device.connected === null || busy;

  return (
    <div className={`rounded-2xl bg-gradient-to-r px-4 py-4 shadow ${gradient} ${className}`}>
      <div className="flex items-center justify-center gap-2">
        <span className="font-semibold">{device.connected === null ? "Checking device..." : isConnected ? "Device Connected" : "Device Disconnected"}</span>
        <span className={`inline-flex items-center justify-center rounded-sm px-1.5 text-xs font-bold leading-5 border ${badge}`} aria-label={isConnected ? "connected" : "disconnected"}>
          {badgeIcon}
        </span>
      </div>

      <p className="mt-1 text-xs text-center opacity-90">{device.id ?? "No device"}</p>

      {/* info pending */}
      {pendingTarget !== null && device.connected !== pendingTarget && <p className="mt-1 text-center text-xs text-zinc-800">Waiting device confirmation…</p>}

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggle(!isConnected)}
          className={`h-10 px-5 rounded-full text-white font-medium shadow
            bg-zinc-900
            ${disabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-95"}`}
          title={!device.id ? "No device" : device.connected === null ? "Waiting device status…" : isConnected ? "Disconnect" : "Connect"}
        >
          {busy ? "Sending…" : isConnected ? "Disconnect" : "Connect"}
        </button>
      </div>

      {err && <p className="mt-2 text-center text-xs text-red-700">{err}</p>}
    </div>
  );
}
