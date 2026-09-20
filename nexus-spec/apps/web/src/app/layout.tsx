import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Nexus — lista de materiales a decisión de compra",
  description: "Documento técnico → requerimientos → propuesta global → lista lista para cotizar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
