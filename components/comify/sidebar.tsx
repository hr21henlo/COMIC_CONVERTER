'use client'

import { motion, useTransform, type MotionValue } from 'framer-motion'

export function Sidebar({ reveal }: { reveal: MotionValue<number> }) {
  // Slide in from the left, tied to the shared curtain reveal progress.
  // Both clamp so the final resting state resolves strictly to x: 0, opacity: 1
  // and the sidebar stays permanently visible after the reveal completes.
  const x = useTransform(reveal, [0, 1], [-30, 0], { clamp: true })
  const opacity = useTransform(reveal, [0, 1], [0, 1], { clamp: true })

  return (
    <motion.aside
      style={{ x, opacity }}
      className="relative z-50 flex w-[110px] shrink-0 flex-col items-center pt-[18px] will-change-transform"
    >
      {/* Logo square */}
      <div className="flex h-[62px] w-[62px] items-center justify-center rounded-[12px] bg-[#051824] p-1.5 border border-[#34e0c4]/40 shadow-lg shadow-black/50 transition-transform hover:scale-105">
        <img
          src="/comicGEN favicon.png"
          alt="ComicGEN Logo"
          className="h-full w-full object-contain filter drop-shadow-[0_2px_4px_rgba(52,224,196,0.3)]"
        />
      </div>

      {/* Nav */}
      <nav className="mt-[62px] flex flex-col items-center gap-[26px]">
        <a
          href="#"
          className="text-[17px] font-normal text-white/95 transition-colors hover:text-[#c9dcf7]"
        >
          Comify
        </a>
        <a
          href="#"
          className="text-[17px] font-normal text-white/95 transition-colors hover:text-[#c9dcf7]"
        >
          Info
        </a>
      </nav>
    </motion.aside>
  )
}
