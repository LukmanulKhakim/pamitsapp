"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HomeIcon, UserIcon, PlusCircleIcon } from "@heroicons/react/24/solid";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getStoredUser, normalizeDeviceId, type AppUser } from "@/services/appAuth";
import { sendStartMeasurement } from "@/services/mqttCommands";

type DeviceDoc = { status?: boolean | null };

export default function BottomNav() {
  const router = useRouter();

  const cached: AppUser | null = getStoredUser();
  const deviceId = normalizeDeviceId(cached?.deviceId ?? null) ?? null;

  const [connected, setConnected] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!deviceId) {
      setConnected(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "devices", deviceId), (snap) => {
      if (!snap.exists()) {
        setConnected(false);
        return;
      }
      const data = snap.data() as DeviceDoc;
      setConnected(data.status === true);
    });
    return () => unsub();
  }, [deviceId]);

  const disabled = !deviceId || connected !== true || sending;

  const onMeasureClick = async () => {
    if (disabled || !deviceId) return;
    try {
      setSending(true);
      await sendStartMeasurement(deviceId);
    } catch (e) {
      console.error("error measurment...", e);
    } finally {
      setSending(false);
      router.push("/measure");
    }
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-50">
      <nav className="w-[260px] md:w-[300px] mx-auto flex items-center justify-between rounded-full bg-black/90 text-white px-6 py-2 shadow-lg border border-zinc-800">
        <Link href="/home" aria-label="Home" className="p-2">
          <HomeIcon className="size-6" />
        </Link>

        <button
          type="button"
          onClick={onMeasureClick}
          disabled={disabled}
          aria-disabled={disabled}
          title={!deviceId ? "No device" : connected === null ? "Checking device…" : connected ? "Start measurement" : "Device disconnected"}
          className={`p-1 rounded-full ring-2 grid place-items-center transition
            ${disabled ? "bg-zinc-600 ring-zinc-400 cursor-not-allowed" : "bg-lime-400 ring-black hover:brightness-105 active:scale-95"}`}
        >
          <PlusCircleIcon className={`size-8 ${disabled ? "text-zinc-300" : "text-black"}`} />
        </button>

        <Link href="/profile" aria-label="Profile" className="p-2">
          <UserIcon className="size-6" />
        </Link>
      </nav>
    </div>
  );
}
