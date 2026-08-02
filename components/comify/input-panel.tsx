'use client'

import { motion, useTransform, type MotionValue } from 'framer-motion'
import { StyleSelector } from './style-selector'
import type { ComicStyle } from './comify-experience'
import { Loader2, Layers } from 'lucide-react'

interface InputPanelProps {
  reveal: MotionValue<number>
  inputText: string
  onInputChange: (val: string) => void
  selectedStyle: ComicStyle
  onStyleChange: (style: ComicStyle) => void
  numPanels: number
  onNumPanelsChange: (count: number) => void
  onGenerate: () => void
  isLoading: boolean
}

export function InputPanel({
  reveal,
  inputText,
  onInputChange,
  selectedStyle,
  onStyleChange,
  numPanels,
  onNumPanelsChange,
  onGenerate,
  isLoading,
}: InputPanelProps) {
  const y = useTransform(reveal, [0.15, 0.7], [20, 0])
  const opacity = useTransform(reveal, [0.15, 0.7], [0, 1])

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0

  return (
    <motion.div
      style={{ y, opacity }}
      className="flex w-full max-w-[340px] flex-col will-change-transform"
    >
      {/* Header & Word Count */}
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[#34e0c4]">
          News Article Input
        </span>
        <span className="text-[11px] text-[#7fa8d8]">
          {wordCount} words
        </span>
      </div>

      {/* Text area */}
      <textarea
        value={inputText}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="Paste your news story here (e.g. 300+ words). Gemini will split it into comic panels!"
        disabled={isLoading}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        className={[
          'h-[clamp(140px,22vh,280px)] w-full resize-none rounded-[8px] bg-[#2b2b2b] p-[16px]',
          'text-[15px] leading-relaxed text-white placeholder:text-[#9a9a9a]',
          'focus:outline-none focus:ring-1 focus:ring-[#34e0c4]/40',
          'overflow-y-auto [&::-webkit-scrollbar]:hidden',
          isLoading ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      />

      {/* Panel Count Picker */}
      <div className="mt-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-[12px] text-[#c9dcf7]">
          <Layers className="h-3.5 w-3.5 text-[#34e0c4]" />
          <span>Comic Panels:</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 rounded-[6px] bg-[#050f1f] p-1">
          {[1, 3, 5, 6].map((count) => {
            const active = numPanels === count
            return (
              <button
                key={count}
                type="button"
                disabled={isLoading}
                onClick={() => onNumPanelsChange(count)}
                className={[
                  'rounded-[4px] py-1 text-[13px] font-semibold transition-all',
                  active
                    ? 'bg-[#34e0c4] text-[#03131c]'
                    : 'text-[#7fa8d8] hover:bg-white/5',
                  isLoading ? 'cursor-not-allowed opacity-50' : '',
                ].join(' ')}
              >
                {count} {count === 1 ? 'Panel' : 'Panels'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Style selector */}
      <div className="mt-4">
        <StyleSelector
          selectedStyle={selectedStyle}
          onStyleChange={onStyleChange}
          disabled={isLoading}
        />
      </div>

      {/* Generate button */}
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isLoading || !inputText.trim()}
          className={[
            'w-full rounded-[10px] py-3.5',
            'text-[18px] font-semibold text-white',
            'shadow-lg shadow-black/30 transition-all duration-200',
            'flex items-center justify-center gap-2',
            isLoading || !inputText.trim()
              ? 'bg-[#1a5a86]/50 cursor-not-allowed'
              : 'bg-[#1a5a86] hover:bg-[#2073aa] active:scale-[0.98]',
          ].join(' ')}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Generating {numPanels} Panels…</span>
            </>
          ) : (
            `Generate ${numPanels} Comic Panel${numPanels > 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </motion.div>
  )
}
