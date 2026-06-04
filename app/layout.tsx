import type { Metadata } from "next";
import { Barlow_Condensed, Bebas_Neue } from "next/font/google";
import "./globals.css";

const dartDisplay = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dart-display",
});

const dartBody = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dart-body",
});

export const metadata: Metadata = {
  title: "Dart Trainer",
  description: "Dart-træning — 301 og mere",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="da"
      className={`${dartDisplay.variable} ${dartBody.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-dart-black font-sans text-dart-cream">
        {children}
      </body>
    </html>
  );
}
