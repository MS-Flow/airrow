import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteAnalytics } from "@/components/analytics";
import { readTheme } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: {
    default: "Airrow · The engineering foundation for AI-native startups",
    template: "%s · Airrow"
  },
  description:
    "Airrow generates the complete engineering foundation for your startup: architecture, specifications, standards and AI context, so your AI agents build it right."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolved on the server so the first paint is already the right theme.
  const theme = await readTheme();

  return (
    <html lang="en" data-theme={theme} className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="font-sans">
        {children}
        {/* Mounted once, here, and filtered to public pages inside the component (spec 153). */}
        <SiteAnalytics />
      </body>
    </html>
  );
}
