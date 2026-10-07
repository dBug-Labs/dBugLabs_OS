import { Anton, Oswald, Barlow, Playfair_Display, Great_Vibes } from 'next/font/google'
import './globals.css'

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap'
})

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
  display: 'swap'
})

const barlow = Barlow({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow',
  display: 'swap'
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap'
})

const greatVibes = Great_Vibes({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-great-vibes',
  display: 'swap'
})

export const metadata = {
  title: 'dBugLabs_OS',
  description: 'Internal operating system and operations portal for dBug Labs',
  robots: {
    index: false,
    follow: false
  }
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${oswald.variable} ${barlow.variable} ${playfair.variable} ${greatVibes.variable}`}
    >
      <body>
        {children}
      </body>
    </html>
  )
}
