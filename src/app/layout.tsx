import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeScript } from "@/components/theme/theme-script";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Bundled OFL fonts (see public/fonts/LICENSES.md) keep builds hermetic and
// let the PDF exporter embed the exact same files the browser renders.
const inter = localFont({
  src: [
    { path: "../../public/fonts/inter-400.ttf", weight: "400" },
    { path: "../../public/fonts/inter-500.ttf", weight: "500" },
    { path: "../../public/fonts/inter-600.ttf", weight: "600" },
    { path: "../../public/fonts/inter-700.ttf", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: [
    { path: "../../public/fonts/space-grotesk-400.ttf", weight: "400" },
    { path: "../../public/fonts/space-grotesk-500.ttf", weight: "500" },
    { path: "../../public/fonts/space-grotesk-700.ttf", weight: "700" },
  ],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    { path: "../../public/fonts/jetbrains-mono-400.ttf", weight: "400" },
    { path: "../../public/fonts/jetbrains-mono-700.ttf", weight: "700" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Forge Labels — Professional vial label design studio",
    template: "%s · Forge Labels",
  },
  description:
    "Design, preview, and print professional labels for 10 mL, 20 mL, and 30 mL vials. Dimension-accurate exports, realistic mockups, and print-ready PDFs.",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#17161d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </AuthProvider>
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
