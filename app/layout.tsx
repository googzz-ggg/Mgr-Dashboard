import type React from "react";
import type { Metadata } from "next";
import { Geist_Mono as GeistMono } from "next/font/google";
import "./globals.css";
import NexusCopilot from "@/components/NexusCopilot";

const geistMono = GeistMono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nexus Prime - Data Nexus Command Center",
  description: "AI-Powered Retail Intelligence War Room | 4000+ Shops Egypt",
  generator: "v0.app",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistMono.className} bg-black text-white antialiased`}>
        {children}
        <NexusCopilot />
      </body>
    </html>
  );
}