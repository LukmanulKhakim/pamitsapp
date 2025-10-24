// src/services/appAuth.ts
"use client";

import { db } from "@/lib/firebase";
import { collection, query, where, limit, getDocs, type DocumentReference, type DocumentData } from "firebase/firestore";

export type AppUser = {
  id: string;
  nama?: string;
  phone?: string;
  company?: string | null;
  deviceId?: string | null;
};

const STORAGE_KEY = "pamits_user";

export function normalizeDeviceId(di: unknown): string | null {
  // DocumentReference
  if (di && typeof di === "object" && (di as DocumentReference<DocumentData>).id) {
    return (di as DocumentReference<DocumentData>).id ?? null;
  }

  if (typeof di === "string") {
    const parts = di.split("/");
    return parts.pop() || null;
  }
  return null;
}

/** Login sederhana: phone + password (field plaintext di Firestore) */
export async function signInPhonePassword(phone: string, password: string) {
  const q = query(collection(db, "users"), where("phone", "==", phone), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Nomor tidak terdaftar.");

  const docu = snap.docs[0];
  const data = docu.data() as {
    nama?: string;
    phone?: string;
    company?: string | null;
    password?: string;
    device_id?: unknown;
  };

  if (data.password !== password) throw new Error("Password salah.");

  const user: AppUser = {
    id: docu.id,
    nama: data.nama,
    phone: data.phone,
    company: data.company ?? null,
    deviceId: normalizeDeviceId(data.device_id),
  };

  setStoredUser(user);
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

export function setStoredUser(u: AppUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
}

export function signOutLocal() {
  localStorage.removeItem(STORAGE_KEY);
}
