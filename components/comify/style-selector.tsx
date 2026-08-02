'use client'

import { useState } from 'react'
import type { ComicStyle } from './comify-experience'

const OPTIONS: { id: ComicStyle; label: string; side: 'left' | 'right' }[] = [
  { id: 'Manga style',      label: 'Manga style',      side: 'right' },
  { id: 'Vintage style',    label: 'Vintage style',    side: 'left'  },
  { id: 'Superhero style',  label: 'Superhero style',  side: 'right' },
  { id: 'Watercolor style', label: 'Watercolor style', side: 'left'  },
]

function Square({ active }: { active: boolean }) {
  return (
    <div
      className={[
        'h-[clamp(28px,3.6vh,42px)] w-[clamp(28px,3.6vh,42px)] shrink-0 rounded-[5px] transition-all duration-200',
        active ? 'bg-[#34e0c4]' : 'bg-[#c9dcf7]/80',
      ].join(' ')}
    />
  )
}

interface StyleSelectorProps {
  selectedStyle: ComicStyle
  onStyleChange: (style: ComicStyle) => void
  disabled?: boolean
}

export function StyleSelector({ selectedStyle, onStyleChange, disabled = false }: StyleSelectorProps) {
  return (
    <div
      className="flex flex-col gap-[10px] rounded-[6px] bg-[#050f1f] p-[6px]"
      role="radiogroup"
      aria-label="Comic style"
    >
      {OPTIONS.map((opt) => {
        const active = selectedStyle === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onStyleChange(opt.id)}
            className={[
              'flex items-center gap-[14px] rounded-[5px] px-[6px] py-[6px] text-left',
              'transition-colors hover:bg-white/[0.03]',
              disabled ? 'cursor-not-allowed opacity-50' : '',
            ].join(' ')}
          >
            {opt.side === 'left' && <Square active={active} />}
            <span
              className={[
                'flex-1 text-[17px] transition-colors',
                opt.side === 'left' ? 'text-center' : '',
                active ? 'text-[#34e0c4]' : 'text-[#7fa8d8]',
              ].join(' ')}
            >
              {opt.label}
            </span>
            {opt.side === 'right' && <Square active={active} />}
          </button>
        )
      })}
    </div>
  )
}
