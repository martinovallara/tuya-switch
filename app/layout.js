import "./globals.css";

export const metadata = {
  title: "Tuya Energy Dashboard",
  description: "Dashboard per storico consumi Tuya"
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
