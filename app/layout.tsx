import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Efectos } from "./motion";
import { Musica } from "./cliente";
import { Santa, Serie } from "./ui";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Intercambio GS",
  description: "El intercambio de la GS: saca tu papelito, arma tu lista y escríbele a tu persona sin que sepa que eres tú.",
  appleWebApp: { capable: true, title: "Intercambio", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#08090a", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh overflow-x-hidden font-sans">
        <div className="brillo-sigue" aria-hidden>
          <div className="brillo" />
          <div className="brillo-pino" />
        </div>
        <div className="nieve" aria-hidden />
        <Santa />
        <Serie />
        <Efectos />
        <div className="relative mx-auto w-full max-w-md px-5 pb-24">{children}</div>
        <Musica />
      </body>
    </html>
  );
}
