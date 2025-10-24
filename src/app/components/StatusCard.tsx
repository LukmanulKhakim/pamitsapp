"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp, DocumentReference, DocumentData } from "firebase/firestore";
import { getStoredUser } from "@/services/appAuth";
import { sendCommand } from "@/services/mqttCommands";

type DeviceState = {
  id: string | null;
  connected: boolean | null; // null = loading
};

function normalizeDeviceId(di: unknown): string | null {
  if (di && typeof di === "object" && (di as DocumentReference).id) {
    return (di as DocumentReference<DocumentData>).id;
  }
  if (typeof di === "string") {
    const parts = di.split("/");
    return parts.pop() || null;
  }
  return null;
}

export default function StatusCard({ className = "" }: { className?: string }) {
  const [device, setDevice] = useState<DeviceState>({ id: null, connected: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // listen device milik user
  useEffect(() => {
    const cached = getStoredUser();
    if (!cached?.id) return;
    const deviceId = cached.deviceId ?? normalizeDeviceId((cached as any)?.device_id);
    if (!deviceId) {
      setDevice({ id: null, connected: null });
      return;
    }
    const unsub = onSnapshot(doc(db, "devices", deviceId), (snap) => {
      if (!snap.exists()) {
        setDevice({ id: deviceId, connected: null });
        return;
      }
      const data = snap.data() as any;
      const status = typeof data.status === "boolean" ? (data.status as boolean) : null;
      setDevice({ id: deviceId, connected: status });
    });
    return () => unsub();
  }, []);

  const isConnected = device.connected === true;

  const gradient = "from-lime-400 to-yellow-300 text-black"; // tetap hijau-kuning sesuai desain
  const badge = device.connected === null ? "border-yellow-600 bg-yellow-300" : isConnected ? "border-green-700 bg-lime-400" : "border-red-700 bg-red-500";
  const badgeIcon = device.connected === null ? "…" : isConnected ? "✅" : "✖";

  const [pending, setPending] = useState<null | boolean>(null); // null/tidak pending, true ingin connect, false ingin disconnect

  const onToggle = useCallback(async () => {
    if (!device.id || busy || device.connected === null) return;
    setBusy(true);
    setErr(null);

    const want = !isConnected; // target status yang diinginkan
    setPending(want); // tampilkan “pending” di UI

    try {
      // console.log("[UI] toggle device:", device.id, "→", want ? "connect" : "disconnect");
      await sendCommand(device.id, want ? "connect" : "disconnect");

      // Tunggu MqttBridge menerima topic `…/status` baru → itulah yang akan menulis ke Firestore.
    } catch (e: any) {
      console.error("toggle device error:", e);
      setErr(e?.message || "Failed to send command");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }, [device.id, busy, isConnected]);

  return (
    <div className={`rounded-2xl bg-gradient-to-r px-4 py-4 shadow ${gradient} ${className}`}>
      {/* headline */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-center gap-2">
            <span className="font-semibold">{device.connected === null ? "Checking device..." : isConnected ? "Device Connected" : "Device Disconnected"}</span>
            <span className={`inline-flex items-center justify-center rounded-sm px-1.5 text-xs font-bold leading-5 border ${badge}`} aria-label={isConnected ? "connected" : "disconnected"}>
              {badgeIcon}
            </span>
          </div>
          <p className="mt-1 text-center text-xs opacity-90">{device.id ?? "No device"}</p>
        </div>
      </div>

      {pending !== null && device.connected !== pending && <p className="mt-1 text-center text-xs text-zinc-800">Waiting device confirmation…</p>}
      {/* tombol connect/disconnect (kapsul) */}
      <div className="mt-3 flex justify-center">
        <button
          disabled={!device.id || device.connected === null || busy}
          onClick={onToggle}
          className={`h-10 px-5 rounded-full text-white font-medium shadow
            bg-zinc-900
            ${!device.id || device.connected === null || busy ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-95"}
          `}
          title={device.connected === null ? "Waiting device status…" : isConnected ? "Disconnect" : "Connect"}
        >
          {busy ? "Updating..." : isConnected ? "Disconnect" : "Connect"}
        </button>
      </div>
      {err && <p className="mt-2 text-center text-xs text-red-700">{err}</p>}
    </div>
  );
}
