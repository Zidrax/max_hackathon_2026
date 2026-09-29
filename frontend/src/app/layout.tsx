import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Мой дом",
  description: "Мини-приложение MAX для жителей и УК",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
