// src/app/components/HeaderCard.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getStoredUser, type AppUser, normalizeDeviceId } from "@/services/appAuth";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, type DocumentReference, type DocumentData } from "firebase/firestore";

type UserDoc = {
  nama?: string | null;
  phone?: string | null;
  company?: string | null;
  device_id?: string | DocumentReference<DocumentData> | null;
};

export default function HeaderCard() {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const cached = getStoredUser();
    if (!cached?.id) return;

    setUser(cached);

    const unsub = onSnapshot(doc(db, "users", cached.id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as UserDoc;

      setUser((prev) => {
        const prevSafe: AppUser = prev ?? { id: snap.id };
        return {
          id: snap.id,
          nama: typeof data.nama === "string" ? data.nama : prevSafe.nama,
          phone: typeof data.phone === "string" ? data.phone : prevSafe.phone,
          company: typeof data.company === "string" || data.company === null ? data.company : prevSafe.company ?? null,
          deviceId: normalizeDeviceId(data.device_id) ?? prevSafe.deviceId ?? null,
        };
      });
    });

    return () => unsub();
  }, []);

  return (
    <div className="p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-zinc-400">Hallo 👋</p>
        <h1 className="text-lg font-bold">{user?.nama ?? "Guest"}</h1>
      </div>
      <Image src="/avatar.png" alt="User avatar" width={32} height={32} className="w-8 h-8 rounded-full border border-zinc-600 object-cover" priority />
    </div>
  );
}
