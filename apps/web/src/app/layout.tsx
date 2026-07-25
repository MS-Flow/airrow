import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { readTheme } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "Airrow — the engineering foundation for AI-native startups", template: "%s · Airrow" },
  description:
    "Airrow generates the complete engineering foundation for your startup — architecture, specifications, standards, and AI context — so Claude Code builds it right."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolved on the server so the first paint is already the right theme.
  const theme = await readTheme();

  return (
    <html lang="en" data-theme={theme} className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
