import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Andes Estate Admin",
  description: "Panel de administracion para propiedades de Andes Estate",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
