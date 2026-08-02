'use client'

import { useState } from 'react'
import type { ComicStyle } from './comify-experience'
import { ChevronDown, Sparkles, Layers, Check, Loader2 } from 'lucide-react'

interface MainInputBarProps {
  inputText: string
  onInputChange: (val: string) => void
  selectedStyle: ComicStyle
  onStyleChange: (style: ComicStyle) => void
  numPanels: number
  onNumPanelsChange: (count: number) => void
  onGenerate: () => void
  isLoading: boolean
}

// ── Animated character SVGs for each style ──────────────────────────────────
// CSS keyframe animations are injected via style tag once per mount
const STYLE_ANIMATIONS = `
  @keyframes mangaRun {
    0%,100% { transform: translateY(0px) rotate(-5deg); }
    50% { transform: translateY(-4px) rotate(5deg); }
  }
  @keyframes vintageWalk {
    0%,100% { transform: translateX(0px) rotate(0deg); }
    25% { transform: translateX(1px) rotate(-3deg); }
    75% { transform: translateX(-1px) rotate(3deg); }
  }
  @keyframes threeDSpin {
    0% { transform: rotateY(0deg) scale(1); }
    50% { transform: rotateY(180deg) scale(0.8); }
    100% { transform: rotateY(360deg) scale(1); }
  }
  @keyframes disneyWave {
    0%,100% { transform: rotate(0deg); }
    25% { transform: rotate(-15deg) translateY(-2px); }
    75% { transform: rotate(15deg) translateY(-2px); }
  }
  @keyframes familyGuyWalk {
    0%,100% { transform: translateX(0px) scaleX(1); }
    25% { transform: translateX(2px) scaleX(0.95); }
    75% { transform: translateX(-2px) scaleX(0.95); }
  }
`

// Mini character SVG components per style
function MangaCharacter({ active }: { active: boolean }) {
  return (
    <svg width="32" height="36" viewBox="0 0 32 36" style={{ animation: 'mangaRun 0.7s ease-in-out infinite', flexShrink: 0 }}>
      {/* Anime chibi bouncing */}
      <ellipse cx="16" cy="8" rx="8" ry="8" fill={active ? '#34e0c4' : '#7fa8d8'} />
      {/* spiky hair */}
      <polygon points="8,4 6,0 10,3" fill={active ? '#0b263b' : '#333'} />
      <polygon points="12,2 11,0 14,2" fill={active ? '#0b263b' : '#333'} />
      <polygon points="20,2 21,0 18,2" fill={active ? '#0b263b' : '#333'} />
      <polygon points="24,4 26,0 22,3" fill={active ? '#0b263b' : '#333'} />
      {/* eyes */}
      <ellipse cx="13" cy="9" rx="2" ry="2.5" fill="white" />
      <ellipse cx="19" cy="9" rx="2" ry="2.5" fill="white" />
      <ellipse cx="13" cy="9.5" rx="1.2" ry="1.5" fill="#222" />
      <ellipse cx="19" cy="9.5" rx="1.2" ry="1.5" fill="#222" />
      {/* body */}
      <rect x="12" y="16" width="8" height="9" rx="2" fill={active ? '#34e0c4' : '#5a7fa8'} />
      {/* legs */}
      <rect x="12" y="25" width="3" height="8" rx="1.5" fill={active ? '#2bb8a4' : '#4a6a8f'} />
      <rect x="17" y="25" width="3" height="8" rx="1.5" fill={active ? '#2bb8a4' : '#4a6a8f'} />
      {/* arms up */}
      <rect x="5" y="17" width="7" height="3" rx="1.5" fill={active ? '#34e0c4' : '#5a7fa8'} transform="rotate(-30 5 17)" />
      <rect x="20" y="17" width="7" height="3" rx="1.5" fill={active ? '#34e0c4' : '#5a7fa8'} transform="rotate(30 27 17)" />
    </svg>
  )
}

function VintageCharacter({ active }: { active: boolean }) {
  return (
    <svg width="32" height="36" viewBox="0 0 32 36" style={{ animation: 'vintageWalk 1s ease-in-out infinite', flexShrink: 0 }}>
      {/* retro dude with hat */}
      <ellipse cx="16" cy="10" rx="7" ry="7" fill={active ? '#fbbf24' : '#c8a96a'} />
      {/* fedora hat */}
      <rect x="7" y="3" width="18" height="4" rx="2" fill={active ? '#422' : '#5a3a1a'} />
      <ellipse cx="16" cy="3" rx="11" ry="2" fill={active ? '#633' : '#7a4a2a'} />
      {/* eyes */}
      <circle cx="13" cy="11" r="1.5" fill="#222" />
      <circle cx="19" cy="11" r="1.5" fill="#222" />
      {/* mustache */}
      <path d="M12 14 Q16 16 20 14" stroke="#422" strokeWidth="1.5" fill="none" />
      {/* body - suit */}
      <rect x="11" y="17" width="10" height="10" rx="2" fill={active ? '#fbbf24' : '#8a6a3a'} />
      {/* tie */}
      <polygon points="16,17 14.5,22 16,24 17.5,22" fill={active ? '#e11' : '#cc2200'} />
      {/* legs */}
      <rect x="11" y="27" width="3.5" height="8" rx="1.5" fill={active ? '#a16207' : '#6a4a1a'} />
      <rect x="17.5" y="27" width="3.5" height="8" rx="1.5" fill={active ? '#a16207' : '#6a4a1a'} />
    </svg>
  )
}

function ThreeDCharacter({ active }: { active: boolean }) {
  return (
    <svg width="32" height="36" viewBox="0 0 32 36" style={{ animation: 'threeDSpin 2s linear infinite', flexShrink: 0 }}>
      {/* 3D cube head */}
      <rect x="8" y="2" width="16" height="14" rx="3" fill={active ? '#34e0c4' : '#5a7fa8'} />
      <polygon points="8,2 5,0 21,0 24,2" fill={active ? '#2bb8a4' : '#3a6080'} />
      <polygon points="24,2 27,0 27,14 24,16" fill={active ? '#1d8c7e' : '#2a4a60'} />
      {/* face pixels */}
      <rect x="11" y="7" rx="1" ry="1" width="3" height="3" fill="#fff" />
      <rect x="18" y="7" rx="1" ry="1" width="3" height="3" fill="#fff" />
      <rect x="12" y="12" rx="1" ry="1" width="8" height="2" fill="#fff" />
      {/* body cube */}
      <rect x="10" y="16" width="12" height="10" rx="2" fill={active ? '#34e0c4' : '#5a7fa8'} />
      {/* legs */}
      <rect x="10" y="26" width="4" height="8" rx="2" fill={active ? '#2bb8a4' : '#3a6080'} />
      <rect x="18" y="26" width="4" height="8" rx="2" fill={active ? '#2bb8a4' : '#3a6080'} />
    </svg>
  )
}

function DisneyCharacter({ active }: { active: boolean }) {
  return (
    <svg width="32" height="36" viewBox="0 0 32 36" style={{ animation: 'disneyWave 0.9s ease-in-out infinite', flexShrink: 0 }}>
      {/* round disney-style head */}
      <circle cx="16" cy="10" r="9" fill={active ? '#fbbf24' : '#e8c06a'} />
      {/* big round eyes */}
      <circle cx="12" cy="10" r="3" fill="white" />
      <circle cx="20" cy="10" r="3" fill="white" />
      <circle cx="12.8" cy="10.5" r="1.8" fill="#222" />
      <circle cx="20.8" cy="10.5" r="1.8" fill="#222" />
      {/* highlight dots */}
      <circle cx="13.5" cy="9.5" r="0.7" fill="white" />
      <circle cx="21.5" cy="9.5" r="0.7" fill="white" />
      {/* big smile */}
      <path d="M10 14 Q16 19 22 14" stroke="#222" strokeWidth="1.5" fill={active ? '#ff9a9a' : '#ffbbbb'} />
      {/* body */}
      <ellipse cx="16" cy="25" rx="7" ry="8" fill={active ? '#34e0c4' : '#5a9ab0'} />
      {/* waving arm */}
      <path d="M23 20 Q28 14 26 10" stroke={active ? '#fbbf24' : '#e8c06a'} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* other arm */}
      <path d="M9 20 Q4 22 5 25" stroke={active ? '#fbbf24' : '#e8c06a'} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* legs */}
      <rect x="11" y="32" width="4" height="4" rx="2" fill={active ? '#2bb8a4' : '#3a7080'} />
      <rect x="17" y="32" width="4" height="4" rx="2" fill={active ? '#2bb8a4' : '#3a7080'} />
    </svg>
  )
}

function FamilyGuyCharacter({ active }: { active: boolean }) {
  return (
    <svg width="32" height="36" viewBox="0 0 32 36" style={{ animation: 'familyGuyWalk 0.8s ease-in-out infinite', flexShrink: 0 }}>
      {/* fat round family guy head */}
      <ellipse cx="16" cy="11" rx="11" ry="10" fill={active ? '#fde68a' : '#d4b87a'} />
      {/* tiny beady eyes */}
      <ellipse cx="12" cy="10" rx="2" ry="2.5" fill="white" />
      <ellipse cx="20" cy="10" rx="2" ry="2.5" fill="white" />
      <circle cx="12" cy="11" r="1.2" fill="#222" />
      <circle cx="20" cy="11" r="1.2" fill="#222" />
      {/* big chin/jaw */}
      <ellipse cx="16" cy="17" rx="8" ry="4" fill={active ? '#fde68a' : '#d4b87a'} />
      {/* smirk */}
      <path d="M12 15 Q16 18 20 15" stroke="#888" strokeWidth="1.2" fill="none" />
      {/* chubby body */}
      <ellipse cx="16" cy="26" rx="9" ry="8" fill={active ? '#34e0c4' : '#5a7fa8'} />
      {/* shirt lines */}
      <line x1="16" y1="19" x2="16" y2="33" stroke="white" strokeWidth="0.8" strokeDasharray="2,2" />
      {/* stubby legs */}
      <rect x="10" y="32" width="4" height="4" rx="2" fill={active ? '#2bb8a4' : '#3a6080'} />
      <rect x="18" y="32" width="4" height="4" rx="2" fill={active ? '#2bb8a4' : '#3a6080'} />
    </svg>
  )
}

const STYLE_OPTIONS: { id: ComicStyle; label: string; desc: string; Character: React.ComponentType<{ active: boolean }> }[] = [
  { id: 'Manga style',   label: 'Manga Style',       desc: 'Japanese shonen high contrast ink',         Character: MangaCharacter },
  { id: 'Vintage style', label: 'Vintage Style',      desc: '1950s golden age newsprint pulp',           Character: VintageCharacter },
  { id: '3D style',      label: '3D Style',            desc: 'Smooth 3D claymation vibrant render',      Character: ThreeDCharacter },
  { id: 'Disney style',  label: 'Disney / P&F Style', desc: 'Phineas and Ferb cartoon vector art',       Character: DisneyCharacter },
  { id: 'Family Guy style', label: 'Family Guy Style', desc: 'Seth MacFarlane bold cartoon illustration', Character: FamilyGuyCharacter },
]

export function MainInputBar({
  inputText,
  onInputChange,
  selectedStyle,
  onStyleChange,
  numPanels,
  onNumPanelsChange,
  onGenerate,
  isLoading,
}: MainInputBarProps) {
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false)

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0

  return (
    <div className="relative z-30 w-full max-w-[860px] mx-auto flex flex-col items-center gap-3">
      {/* Inject style animations once */}
      <style>{STYLE_ANIMATIONS}</style>

      {/* Hand-drawn Main Page Input Pill Bar */}
      <div className="relative z-30 flex w-full flex-col md:flex-row items-center gap-2 rounded-[28px] border-2 border-[#34e0c4]/40 bg-[#071926]/90 p-2.5 shadow-2xl backdrop-blur-md">
        
        {/* Main Text / News Input Field */}
        <div className="relative flex-1 w-full">
          <textarea
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="TEXT OR NEWS... (Paste news or story to convert to AI comic)"
            disabled={isLoading}
            rows={2}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            className="w-full resize-none bg-transparent px-4 py-2 text-[15px] md:text-[16px] leading-normal text-white placeholder:text-white/40 focus:outline-none overflow-y-auto [&::-webkit-scrollbar]:hidden"
          />
          {wordCount > 0 && (
            <span className="absolute bottom-1 right-3 text-[10px] font-bold text-[#34e0c4]/80">
              {wordCount} words
            </span>
          )}
        </div>

        {/* Embedded Character Styles Dropdown */}
        <div className="relative flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="relative">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setIsStyleDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full bg-[#0b263b] border border-[#34e0c4]/30 px-3.5 py-2 text-[13px] font-bold text-[#34e0c4] hover:bg-[#113552] transition-all"
            >
              <span>{selectedStyle} ({numPanels}P)</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isStyleDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Character Style & Panel Count Dropdown Menu */}
            {isStyleDropdownOpen && (
              <div className="absolute right-0 top-12 z-50 w-[320px] rounded-[16px] border border-[#34e0c4]/30 bg-[#071926] p-3 shadow-2xl backdrop-blur-xl">
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[#34e0c4]">
                  Character Art Style
                </div>
                <div className="flex flex-col gap-1 mb-3">
                  {STYLE_OPTIONS.map((opt) => {
                    const active = selectedStyle === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onStyleChange(opt.id)
                          setIsStyleDropdownOpen(false)
                        }}
                        className={[
                          'flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-all',
                          active
                            ? 'bg-[#34e0c4]/15 ring-1 ring-[#34e0c4]/60'
                            : 'hover:bg-white/5',
                        ].join(' ')}
                      >
                        {/* Animated character */}
                        <div className="w-[36px] flex items-center justify-center shrink-0">
                          <opt.Character active={active} />
                        </div>
                        {/* Text info */}
                        <div className="flex-1 min-w-0">
                          <div className={`text-[13px] font-bold ${active ? 'text-[#34e0c4]' : 'text-white/90'}`}>
                            {opt.label}
                          </div>
                          <div className="text-[10px] text-white/50">{opt.desc}</div>
                        </div>
                        {active && <Check className="h-4 w-4 text-[#34e0c4] shrink-0" />}
                      </button>
                    )
                  })}
                </div>

                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#34e0c4] flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  <span>Panels to Generate</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 3, 5, 6].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        onNumPanelsChange(count)
                        setIsStyleDropdownOpen(false)
                      }}
                      className={[
                        'rounded-[6px] py-1 text-[12px] font-bold transition-all',
                        numPanels === count
                          ? 'bg-[#34e0c4] text-[#03131c]'
                          : 'bg-[#122b3f] text-[#7fa8d8] hover:bg-white/10',
                      ].join(' ')}
                    >
                      {count} P
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Generate Button */}
          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading || !inputText.trim()}
            className={[
              'rounded-full px-5 py-2.5 text-[14px] md:text-[15px] font-extrabold text-[#03131c]',
              'shadow-lg shadow-[#34e0c4]/20 transition-all duration-200 shrink-0',
              'flex items-center justify-center gap-2',
              isLoading || !inputText.trim()
                ? 'bg-[#34e0c4]/40 cursor-not-allowed text-[#03131c]/50'
                : 'bg-[#34e0c4] hover:bg-[#2bcbb3] active:scale-[0.97]',
            ].join(' ')}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                <span>Creating Comic…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4.5 w-4.5" />
                <span>Generate Comic</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
