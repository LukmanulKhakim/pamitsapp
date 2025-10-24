"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PhoneIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, ChevronDoubleRightIcon } from "@heroicons/react/24/solid";
import { signInPhonePassword, getStoredUser } from "@/services/appAuth";

/** Komponen dalam yang pakai useSearchParams */
function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/home";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (user) router.replace(next);
  }, [router, next]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signInPhonePassword(phone.trim(), password);
      router.replace(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto w-full max-w-screen-sm px-4 pt-4 pb-6">
        {/* HEADER */}
        <section className="relative rounded-[22px] overflow-hidden min-h-[220px] grid items-center bg-black">
          <div className="absolute inset-0 opacity-30 bg-center bg-cover" style={{ backgroundImage: "url('/map.png')" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/20" />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2">
              <Image src="/pamitslogo.png" alt="Pamits" width={96} height={24} className="h-6 w-auto" priority />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold leading-snug">
              Get started and set up your <span className="text-lime-400">account</span> now!
            </h1>
          </div>
        </section>

        {/* FORM */}
        <section className="-mx-4 mt-3 rounded-t-[24px] bg-white text-black p-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-600 mb-1">Your Phone</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <PhoneIcon className="w-5 h-5" />
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="087654321345"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-full border border-zinc-300 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-lime-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-600 mb-1">Choose a password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <LockClosedIcon className="w-5 h-5" />
                </span>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="**********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-full border border-zinc-300 pl-10 pr-12 py-3 outline-none focus:ring-2 focus:ring-lime-400"
                />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700" aria-label={showPass ? "Hide password" : "Show password"}>
                  {showPass ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* kapsul + submit */}
            <div className="relative mt-2">
              <div className="w-full h-12 rounded-full bg-black text-white grid place-items-center">
                <span className="font-medium">{loading ? "Signing in..." : "Login Now"}</span>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2
                           w-11 h-11 rounded-full bg-lime-400 ring-2 ring-black
                           grid place-items-center hover:brightness-105 active:scale-95
                           disabled:opacity-60 transition"
                aria-label="Login"
              >
                <ChevronDoubleRightIcon className="w-5 h-5 text-black" />
              </button>
            </div>

            {err && <p className="text-sm text-red-600">{err}</p>}
          </form>

          <div className="mt-6 text-center text-xs text-zinc-500">Versi 1.0.0</div>
        </section>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
