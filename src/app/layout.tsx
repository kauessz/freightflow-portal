import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/hooks/useToast";
import ToastContainer from "@/components/ToastContainer";
import NavigationSpinner from "@/components/NavigationSpinner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FreightFlow Portal",
  description: "Maritime shipment tracking and management portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ToastProvider>
          <NavigationSpinner />
          {children}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  );
}
