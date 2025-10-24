"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeftIcon } from "@heroicons/react/24/solid";

import { db } from "@/lib/firebase";
import { doc, onSnapshot, getDoc, type DocumentReference, type DocumentData } from "firebase/firestore";
import { getStoredUser, signOutLocal, type AppUser } from "@/services/appAuth";

type ProfileState = {
  name: string;
  companyName: string;
  phone: string;
  avatar: string;
};

type UserDoc = {
  nama?: string | null;
  phone?: string | null;
  company?: string | DocumentReference<DocumentData> | null;
};

function isDocRef(v: unknown): v is DocumentReference<DocumentData> {
  return !!v && typeof v === "object" && "id" in (v as object);
}

export default function ProfilePage() {
  const router = useRouter();

  const [p, setP] = useState<ProfileState>({
    name: "—",
    companyName: "—",
    phone: "—",
    avatar: "/avatar.png",
  });

  useEffect(() => {
    const cached: AppUser | null = getStoredUser();
    if (!cached?.id) {
      router.replace("/login");
      return;
    }

    async function resolveCompanyName(companyField: UserDoc["company"]): Promise<string> {
      try {
        // Case 1: DocumentReference
        if (isDocRef(companyField)) {
          const snap = await getDoc(companyField);
          if (snap.exists()) {
            const n = snap.get("name") as string | undefined;
            return n ?? "—";
          }
        }

        // Case 2: string path "/companies/{id}"
        if (typeof companyField === "string") {
          const id = companyField.split("/").pop();
          if (id) {
            const snap = await getDoc(doc(db, "companies", id));
            if (snap.exists()) {
              const n = snap.get("name") as string | undefined;
              return n ?? "—";
            }
          }
        }
      } catch {
        // ignore
      }
      return "—";
    }

    const unsub = onSnapshot(doc(db, "users", cached.id), async (snap) => {
      if (!snap.exists()) return;

      const data = snap.data() as UserDoc;
      const companyName = await resolveCompanyName(data.company ?? null);

      setP((prev) => ({
        ...prev,
        name: typeof data.nama === "string" ? data.nama : prev.name,
        phone: typeof data.phone === "string" ? data.phone : prev.phone,
        companyName,
      }));
    });

    return () => unsub();
  }, [router]);

  const handleLogout = () => {
    signOutLocal();
    router.replace("/login");
  };

  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto w-full max-w-screen-sm px-4 pt-4 pb-6">
        {/* Header */}
        <div className="mb-3">
          <Link href="/home" className="inline-flex items-center gap-2 text-zinc-300 hover:text-white">
            <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-zinc-800">
              <ChevronLeftIcon className="w-5 h-5" />
            </span>
            <span>Back</span>
          </Link>
        </div>

        {/* Avatar + Nama */}
        <div className="grid place-items-center">
          <Image src={p.avatar} alt={p.name} height={64} width={64} className="w-24 h-24 rounded-full border border-zinc-600 object-cover" priority />
          <h1 className="mt-3 text-lg font-semibold">{p.name}</h1>
        </div>

        {/* Card list */}
        <div className="mt-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
          {/* Company */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-sm text-zinc-300">Company</span>
            <span className="text-sm text-zinc-100">{p.companyName}</span>
          </div>

          {/* Phone */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-sm text-zinc-300">Phone</span>
            <a href={`tel:${p.phone}`} className="text-sm text-zinc-100 hover:underline">
              {p.phone}
            </a>
          </div>

          {/* About */}
          <Link href="/about" className="block px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/60 transition">
            <span className="text-sm text-zinc-100">About Us</span>
          </Link>

          {/* Help */}
          <Link href="/help" className="block px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/60 transition">
            <span className="text-sm text-zinc-100">Help & Feedback</span>
          </Link>

          {/* Logout */}
          <button onClick={handleLogout} className="w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition">
            <span className="text-sm font-medium text-red-400">Log Out</span>
          </button>
        </div>

        {/* Footer versi */}
        <div className="mt-6 text-center text-xs text-zinc-400">
          Versi 1.0.0
          <br />
          pamitsapp 2025
        </div>
      </div>
    </div>
  );
}
