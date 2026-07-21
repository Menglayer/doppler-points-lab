import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Doppler 空投计算器 | Points Lab",
  description: "查询 Ethereum 与 XRPL 地址的 Doppler 积分、排名，并按自定义空投池估算代币数量。",
  keywords: ["Doppler", "Airdrop", "Points", "XRPL", "Ethereum"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Doppler 空投计算器 | Points Lab" />
        <meta property="og:description" content="查询 Doppler 积分、排名，并估算自定义空投情景。" />
        <meta property="og:image" content={`${basePath}/og.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${basePath}/og.png`} />
      </head>
      <body>{children}</body>
    </html>
  );
}
