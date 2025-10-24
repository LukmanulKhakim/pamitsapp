import "./globals.css";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <div className="min-h-dvh">
          {/* no overflow-hidden */}
          <div className="mx-auto w-full max-w-screen-sm px-4 flex flex-col min-h-dvh">{children}</div>
        </div>
      </body>
    </html>
  );
}
