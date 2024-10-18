import { Inter } from 'next/font/google'
import { Noto_Sans_Malayalam } from 'next/font/google'
import "./globals.css"

const inter = Inter({ subsets: ['latin'] })

const notoSansMalayalam = Noto_Sans_Malayalam({
  weight: ['400', '700'],
  subsets: ['malayalam'],
  display: 'swap',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
      </head>
      <body className={`${inter.className} ${notoSansMalayalam.variable}`}>{children}</body>
    </html>
  )
}
