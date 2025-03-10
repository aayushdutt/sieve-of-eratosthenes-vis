import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sieve of Eratosthenes Visualizer",
  description: "A visualizer for the Sieve of Eratosthenes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
