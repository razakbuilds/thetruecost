import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrueCost — Event Budget Reference",
  description:
    "Get a free, itemized event budget estimate for weddings, naming ceremonies, burials and corporate events in Nigeria.",
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
