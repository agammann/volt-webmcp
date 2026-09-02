import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://volt.alx21.chatgpt.site'),
  title: 'Volt — EV trip intelligence',
  description:
    'Plan charger-aware EV road trips with an agent that understands range, speed, amenities, and arrival goals.',
  openGraph: {
    title: 'Volt — EV trip intelligence',
    description: 'EV trip intelligence, built for people and agents.',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Volt — EV trip intelligence, built for people and agents.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Volt — EV trip intelligence',
    description: 'EV trip intelligence, built for people and agents.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

