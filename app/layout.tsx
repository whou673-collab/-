import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: '绘序 HUIXU — 让灵感，即刻成像',
  description: '你的 AI 图像创作工作台。连接自己的生图 API，发现模型，用多张参考图创作，并私密保存每一次灵感。',
  applicationName: '绘序 HUIXU',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f6f7f9',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`light bg-background ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="bottom-right" closeButton />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
