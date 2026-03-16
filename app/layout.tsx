import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NurseAsyst",
  description: "School nurse supply tracking",
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
