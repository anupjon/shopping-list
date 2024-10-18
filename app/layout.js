import { Inter } from 'next/font/google'
import { Noto_Sans_Malayalam } from 'next/font/google'
import "./globals.css"

const inter = Inter({ subsets: ['latin'] })

const notoSansMalayalam = Noto_Sans_Malayalam({
  weight: ['400', '700'],
  subsets: ['malayalam'],
  display: 'swap',
})

export const metadata = {
  title: 'Shopping List PWA',
  description: 'A simple shopping list progressive web app',
  manifest: '/manifest.json',
  themeColor: '#000000',
  viewport: 'minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, viewport-fit=cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Shopping List PWA" />
      </head>
      <body className={`${inter.className} ${notoSansMalayalam.variable}`}>{children}</body>
    </html>
  )
}
