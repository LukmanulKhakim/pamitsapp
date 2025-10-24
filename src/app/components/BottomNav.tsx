"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HomeIcon, UserIcon, PlusCircleIcon } from "@heroicons/react/24/solid";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, DocumentReference, DocumentData } from "firebase/firestore";
import { getStoredUser } from "@/services/appAuth";
import { sendStartMeasurement } from "@/services/mqttCommands";

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

export default function BottomNav() {
  const router = useRouter();
  const u = getStoredUser();
  const deviceId = u?.deviceId ?? normalizeDeviceId((u as any)?.device_id);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!deviceId) {
      setConnected(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "devices", deviceId), (snap) => {
      const ok = snap.exists() && typeof snap.data().status === "boolean" ? (snap.data().status as boolean) : false;
      setConnected(ok);
    });
    return () => unsub();
  }, [deviceId]);

  const disableMeasure = !deviceId || connected !== true || sending;

  const onMeasureClick = async () => {
    if (disableMeasure) return;
    try {
      setSending(true);
      await sendStartMeasurement(deviceId!); // minta ESP32 mulai kirim telemetry
    } catch (e) {
      console.error("start_measurement error:", e);
      // opsional: tampilkan toast
    } finally {
      setSending(false);
      router.push("/measure"); // pindah ke page measurement
    }
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-50">
      <nav className="w-[260px] md:w-[300px] mx-auto flex items-center justify-between rounded-full bg-black/90 text-white px-6 py-2 shadow-lg border border-zinc-800">
        <Link href="/home" aria-label="Home" className="p-2">
          <HomeIcon className="size-6" />
        </Link>

        {/* Tombol Measurement: disabled jika device disconnect / belum siap */}
        <button
          type="button"
          onClick={onMeasureClick}
          disabled={disableMeasure}
          aria-disabled={disableMeasure}
          title={!deviceId ? "No device" : connected === null ? "Checking device…" : connected ? "Start measurement" : "Device disconnected"}
          className={`p-1 rounded-full ring-2 grid place-items-center transition
            ${disableMeasure ? "bg-zinc-600 ring-zinc-400 cursor-not-allowed" : "bg-lime-400 ring-black hover:brightness-105 active:scale-95"}`}
        >
          <PlusCircleIcon className={`size-8 ${disableMeasure ? "text-zinc-300" : "text-black"}`} />
        </button>

        <Link href="/profile" aria-label="Profile" className="p-2">
          <UserIcon className="size-6" />
        </Link>
      </nav>
    </div>
  );
}
