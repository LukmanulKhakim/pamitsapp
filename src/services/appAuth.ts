// src/services/appAuth.ts
"use client";

import { db } from "@/lib/firebase";
import { collection, query, where, limit, getDocs, DocumentData, DocumentReference } from "firebase/firestore";

export type AppUser = {
  id: string;
  nama: string;
  phone: string;
  company?: any;
  deviceId?: string | null; // ← gunakan string ID, bukan DocumentReference
};

const STORAGE_KEY = "pamits_user";

function normalizeDeviceId(di: unknown): string | null {
  // DocumentReference
  if (di && typeof di === "object" && (di as DocumentReference).id) {
    return (di as DocumentReference).id;
  }
  // path string "/devices/PAMITS001"
  if (typeof di === "string") {
    const parts = di.split("/");
    return parts.pop() || null;
  }
  return null;
}

export async function signInPhonePassword(phone: string, password: string) {
  const q = query(collection(db, "users"), where("phone", "==", phone), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Nomor tidak terdaftar.");

  const docu = snap.docs[0];
  const data = docu.data() as DocumentData;

  if (data.password !== password) throw new Error("Password salah.");

  const user: AppUser = {
    id: docu.id,
    nama: data.nama,
    phone: data.phone,
    company: data.company ?? null,
    deviceId: normalizeDeviceId(data.device_id), // ← simpan string
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function getStoredUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export function signOutLocal() {
  localStorage.removeItem(STORAGE_KEY);
}
