import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

const displaySans = Space_Grotesk({
  variable: "--font-display-sans",
  subsets: ["latin"],
});

const appMono = IBM_Plex_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "VibeLaTeX",
  description: "Real-time LaTeX workbench with AI format and fix actions.",
};

const THEME_INIT_SCRIPT = `
(() => {
  try {
    const raw = window.localStorage.getItem("vibelatex:theme:v1");
    if (!raw) {
      return;
    }

    const data = JSON.parse(raw);
    const theme = data && data.version === 1 ? data.theme : null;
    if (theme === "light") {
      document.documentElement.dataset.theme = "light";
      return;
    }

    if (theme === "dark") {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch {
    // Ignore invalid localStorage payload.
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${displaySans.variable} ${appMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
