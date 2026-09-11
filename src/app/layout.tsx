import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Salida Discovery",
  description: "Sistema de salida escolar — Discovery American Preschool & Academy",
  applicationName: "Salida Discovery",
  appleWebApp: {
    capable: true,
    title: "Discovery",
    statusBarStyle: "default",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-d.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/favicon-d.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1B4D3E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-cream text-ink" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
