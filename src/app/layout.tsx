import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WordClash — Multiplayer Wordle",
  description: "Race your friends to solve the word.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
