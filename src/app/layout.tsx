import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans_KR({
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RFA · 결재함 + 비서 채팅",
  description: "외부 문의에 에이전트가 쓴 답변 초안을 결재하고, 비서 에이전트에게 담당자를 찾아 물어보는 앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
