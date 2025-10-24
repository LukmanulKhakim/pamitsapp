"use client";

import { useEffect, useState } from "react";
import { getStoredUser, type AppUser } from "@/services/appAuth";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function HeaderCard() {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const cached = getStoredUser();
    if (!cached?.id) return;

    // set dari cache dulu biar cepet
    setUser(cached);

    // listen dokumen user di Firestore → auto update saat nama berubah
    const unsub = onSnapshot(doc(db, "users", cached.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setUser((prev) => ({
          id: snap.id,
          nama: data.nama ?? prev?.nama ?? "Guest",
          phone: data.phone ?? prev?.phone,
          company: data.company ?? prev?.company,
          device_id: data.device_id ?? prev?.deviceId,
        }));
      }
    });

    return () => unsub();
  }, []);

  return (
    <div className="p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-zinc-400">Hallo 👋</p>
        <h1 className="text-lg font-bold">{user?.nama ?? "Guest"}</h1>
      </div>
      <img src="/avatar.png" alt="User avatar" className="w-8 h-8 rounded-full border border-zinc-600 object-cover" />
    </div>
  );
}
