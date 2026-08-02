'use client'

import { useEffect, useState } from 'react'
import {
  motion,
  AnimatePresence,
} from 'framer-motion'

type Greeting = { text: string; lang: string; rtl?: boolean }

const GREETINGS: Greeting[] = [
  { text: 'स्वागतम्', lang: 'sa' },
  { text: 'Willkommen', lang: 'de' },
  { text: 'Aloha', lang: 'haw' },
  { text: 'أهلاً وسهلاً', lang: 'ar', rtl: true },
  { text: 'Benvenuto', lang: 'it' },
  { text: 'ようこそ', lang: 'ja' },
  { text: 'Welcome', lang: 'en' },
  { text: '환영합니다', lang: 'ko' },
  { text: 'Üdvözöljük', lang: 'hu' },
]

export function HeroCurtain() {
  const [index, setIndex] = useState(0)

  // Infinite loop — never stops, even while the user scrolls. Brisk 600ms
  // cadence paced to the fast 0.25s cross-fade for a modern, snappy feel.
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % GREETINGS.length)
    }, 600)
    return () => clearInterval(id)
  }, [])

  const current = GREETINGS[index]

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#EBF3FB]"
      role="presentation"
    >
      <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={index}
            dir={current.rtl ? 'rtl' : 'ltr'}
            lang={current.lang}
            className="block whitespace-nowrap text-7xl font-bold leading-none tracking-tight text-[#0A0E14] md:text-9xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {current.text}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Minimal scroll cue */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
        aria-hidden="true"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
          className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-[#0b1524]/40 pt-2"
        >
          <span className="h-2 w-1 rounded-full bg-[#0b1524]/50" />
        </motion.div>
      </div>
    </div>
  )
}
