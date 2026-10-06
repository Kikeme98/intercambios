import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Efectos } from "./motion";
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
        {/* Refracción del liquid glass: ruido suavizado que desplaza lo que hay detrás del vidrio. */}
        <svg width="0" height="0" className="absolute" aria-hidden>
          <filter id="refraccion" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="11" result="ruido" />
            <feGaussianBlur in="ruido" stdDeviation="3" result="suave" />
            <feDisplacementMap in="SourceGraphic" in2="suave" scale="34" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <div className="brillo-sigue" aria-hidden>
          <div className="brillo" />
        </div>
        <Efectos />
        <div className="relative mx-auto w-full max-w-md px-5 pb-16">{children}</div>
      </body>
    </html>
  );
}
