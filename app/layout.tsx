import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRICKWORKS — Build Your Next Adventure",
  description: "The opening menu for BRICKWORKS, a playful 3D brick-building world.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
