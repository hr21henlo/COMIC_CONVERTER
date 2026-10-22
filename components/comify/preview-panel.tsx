'use client'

import { useState, useEffect } from 'react'
import {
  Download, ImageOff, MessageSquare, ChevronLeft,
  ChevronRight, LayoutGrid, Maximize2, Minimize2, Globe, Loader2,
  Zap, Share2, BookOpen,
} from 'lucide-react'
import type { GenerationState } from './comify-experience'
import { SpeechBubble, BubbleType } from './SpeechBubble'

const POP_ART_BUBBLE_TYPES: BubbleType[] = ['oval', 'burst', 'box']
const POP_ART_BORDER_COLORS = ['#DC2626', '#2563EB', '#059669', '#D97706', '#9333EA', '#E11D48']

function getPopArtBubbleStyle(idx: number) {
  const type = POP_ART_BUBBLE_TYPES[idx % POP_ART_BUBBLE_TYPES.length]
  const color = POP_ART_BORDER_COLORS[idx % POP_ART_BORDER_COLORS.length]
  return { type, color }
}

interface PreviewPanelProps {
  generation: GenerationState
  onDownload: (cardIndex: number) => void
  onTranslatePanel: (panelIndex: number, targetLanguage: string) => Promise<void>
  isExpanded: boolean
  onToggleExpand: (expanded: boolean) => void
  activeLayoutId: number
}

// ─── Comic Card Component (Used across layouts) ───────────────────────────────
function ComicCard({
  card,
  idx,
  onClick,
  style = {},
  className = '',
}: {
  card: any
  idx: number
  onClick: () => void
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        border: '3px solid #0A0A0A',
        background: '#FFFFFF',
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        ...style,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px,-2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '5px 5px 0px #4361EE'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translate(0,0)'
        // Use the original box-shadow defined in the style prop if available
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = style.boxShadow ? String(style.boxShadow) : '3px 3px 0px #0A0A0A'
      }}
    >
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.headline}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#0A0A0A' }}
        />
      )}
      {!card.imageUrl && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0EBD8', fontSize: 12, fontFamily: 'var(--nb-font)', fontWeight: 700, color: '#0A0A0A', opacity: 0.4 }}>
          {card.imageLoading ? 'Rendering...' : 'No Image'}
        </div>
      )}
      {/* Headline — compact top banner */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 10, background: '#FFE66D', borderBottom: '2px solid #0A0A0A', padding: '2px 8px', opacity: 0.95 }}>
        <p style={{ fontFamily: "'Bangers', 'Comic Neue', cursive, sans-serif", fontWeight: 400, fontSize: 10, color: '#0A0A0A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          P{idx + 1}: {card.headline}
        </p>
      </div>
      {/* Speech bubble — small, anchored to side corner */}
      {card.speechBubble && (
        <div style={{ position: 'absolute', top: 22, zIndex: 20, maxWidth: '50%', ...(idx % 2 === 1 ? { left: 6 } : { right: 6 }) }}>
          <SpeechBubble text={card.speechBubble} />
        </div>
      )}
      {/* Caption strip — compact bottom */}
      {(card.brief1 || card.brief2) && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', zIndex: 10, background: '#FFE66D', borderTop: '2px solid #0A0A0A', padding: '2px 8px', opacity: 0.95 }}>
          <p style={{ fontFamily: "'Comic Neue', 'Space Grotesk', cursive, sans-serif", fontWeight: 700, fontSize: 9, color: '#0A0A0A', margin: 0, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textTransform: 'uppercase' }}>
            {card.brief1} {card.brief2 ? `• ${card.brief2}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}

const LANGUAGE_OPTIONS = [
  { code: 'hi-IN', label: 'Hindi (हिंदी)' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
  { code: 'te-IN', label: 'Telugu (తెలుగు)' },
  { code: 'bn-IN', label: 'Bengali (বাংলা)' },
  { code: 'mr-IN', label: 'Marathi (मराठी)' },
  { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)' },
  { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
  { code: 'es-ES', label: 'Spanish (Español)' },
  { code: 'fr-FR', label: 'French (Français)' },
  { code: 'de-DE', label: 'German (Deutsch)' },
  { code: 'ja-JP', label: 'Japanese (日本語)' },
]

// ─── Nb Action Button ─────────────────────────────────────────────────────────
function NbActionBtn({
  id,
  onClick,
  disabled,
  color = '#FFFFFF',
  textColor = '#0A0A0A',
  children,
}: {
  id?: string
  onClick?: () => void
  disabled?: boolean
  color?: string
  textColor?: string
  children: React.ReactNode
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: '10px 18px',
        background: disabled ? '#E0E0E0' : color,
        color: disabled ? '#999' : textColor,
        border: '3px solid #0A0A0A',
        borderRadius: 8,
        boxShadow: disabled ? 'none' : '4px 4px 0px #0A0A0A',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--nb-font)',
        fontWeight: 800,
        fontSize: 13,
        transition: 'all 0.08s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-2px,-2px)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '6px 6px 0px #0A0A0A'
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translate(0,0)'
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = disabled ? 'none' : '4px 4px 0px #0A0A0A'
      }}
      onMouseDown={e => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translate(3px,3px)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
        }
      }}
      onMouseUp={e => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-2px,-2px)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '6px 6px 0px #0A0A0A'
        }
      }}
    >
      {children}
    </button>
  )
}

export function PreviewPanel({
  generation,
  onDownload,
  onTranslatePanel,
  isExpanded,
  onToggleExpand,
  activeLayoutId,
}: PreviewPanelProps) {
  const [activePanelIndex, setActivePanelIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single')
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN')
  const [isTranslating, setIsTranslating] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)
  const [brokenImages, setBrokenImages] = useState<Record<number, string>>({})

  // Swipe gesture support for mobile/touch
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchEndX, setTouchEndX] = useState<number | null>(null)

  const { status, cards, error } = generation
  const isLoading = status === 'generating-script' || status === 'generating-images'
  const hasCards = cards.length > 0
  const safePanelIndex = Math.min(activePanelIndex, Math.max(0, cards.length - 1))
  const activeCard = cards[safePanelIndex] || cards[0]

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return
    const distance = touchStartX - touchEndX
    const isLeftSwipe = distance > 45
    const isRightSwipe = distance < -45
    if (isLeftSwipe && safePanelIndex < cards.length - 1) {
      setActivePanelIndex(prev => prev + 1)
    }
    if (isRightSwipe && safePanelIndex > 0) {
      setActivePanelIndex(prev => prev - 1)
    }
    setTouchStartX(null)
    setTouchEndX(null)
  }

  // Keyboard arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasCards) return
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setActivePanelIndex(prev => Math.min(cards.length - 1, prev + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setActivePanelIndex(prev => Math.max(0, prev - 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasCards, cards.length])

  const handleTranslateClick = async () => {
    if (!hasCards || isTranslating) return
    setIsTranslating(true)
    try {
      // Translate ALL panels concurrently, not just the active one
      const translatePromises = cards.map((_, i) => onTranslatePanel(i, selectedLanguage))
      await Promise.all(translatePromises)
    } finally {
      setIsTranslating(false)
    }
  }

  const handleShareClick = async () => {
    if (navigator.share && activeCard?.imageUrl) {
      try {
        await navigator.share({
          title: activeCard.headline || 'ComicGEN Strip',
          text: activeCard.brief1 || 'Check out this AI comic panel!',
          url: window.location.href,
        })
        return
      } catch (e) {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2000)
    } catch (err) {
      console.error('Share error:', err)
    }
  }

  return (
    <div
      className="w-full flex flex-col items-center h-[calc(100vh-150px)] max-h-[calc(100vh-150px)] overflow-hidden"
      style={{
        width: '100%',
        maxWidth: isExpanded ? 1100 : (viewMode === 'single' ? 760 : 680),
        height: 'calc(100vh - 150px)',
        maxHeight: 'calc(100vh - 150px)',
        transition: 'max-width 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* ── Main Canvas ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          minHeight: 0,
          background: '#FFFBF0',
          border: '3px solid #0A0A0A',
          borderRadius: 12,
          boxShadow: '6px 6px 0px #0A0A0A',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >

        {/* ── Loading State ── */}
        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
            background: '#FFFBF0',
          }}>
            {/* Brutalist loading indicator */}
            <div style={{
              width: 80, height: 80,
              border: '5px solid #0A0A0A',
              borderRadius: 12,
              background: '#FFE66D',
              boxShadow: '6px 6px 0px #0A0A0A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'spin 1.5s linear infinite',
            }}>
              <Zap size={36} strokeWidth={3} color="#0A0A0A" />
            </div>
            <div style={{ textAlign: 'center', maxWidth: 300 }}>
              <p style={{ fontFamily: 'var(--nb-font)', fontWeight: 900, fontSize: 16, color: '#0A0A0A', margin: '0 0 6px' }}>
                {status === 'generating-script'
                  ? '✍️ Writing comic script...'
                  : `🎨 Rendering ${cards.length} panels...`}
              </p>
              <p style={{ fontFamily: 'var(--nb-font)', fontWeight: 600, fontSize: 12, color: '#0A0A0A', opacity: 0.5, margin: 0 }}>
                Powered by Gemini AI + NVIDIA FLUX
              </p>
            </div>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 12, height: 12,
                  background: '#FFE66D',
                  border: '2px solid #0A0A0A',
                  borderRadius: 3,
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 32, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64,
              background: '#FF6B6B',
              border: '3px solid #0A0A0A',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '5px 5px 0px #0A0A0A',
            }}>
              <ImageOff size={30} color="#FFFFFF" strokeWidth={3} />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--nb-font)', fontWeight: 900, fontSize: 18, color: '#0A0A0A', margin: '0 0 8px' }}>
                GENERATION FAILED
              </p>
              <p style={{ fontFamily: 'var(--nb-font)', fontSize: 13, color: '#0A0A0A', opacity: 0.6, maxWidth: 320, margin: 0, lineHeight: 1.6 }}>
                {error}
              </p>
            </div>
            <div style={{
              padding: '8px 16px',
              background: '#FF6B6B',
              border: '3px solid #0A0A0A',
              borderRadius: 6,
              fontFamily: 'var(--nb-font)',
              fontWeight: 800,
              fontSize: 12,
              color: '#FFFFFF',
            }}>
              Try again with different text ↑
            </div>
          </div>
        )}

        {/* ── Idle State ── */}
        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 32px', textAlign: 'center' }}>
            {/* Decorative comic panel grid mockup */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: 120, opacity: 0.25 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{
                  height: i === 0 ? 60 : 40,
                  gridColumn: i === 0 ? 'span 2' : 'span 1',
                  background: '#0A0A0A',
                  border: '2px solid #0A0A0A',
                  borderRadius: 4,
                }} />
              ))}
            </div>
            <div>
              <p style={{ fontFamily: 'var(--nb-font)', fontWeight: 900, fontSize: 22, color: '#0A0A0A', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
                Ready to Create!
              </p>
              <p style={{ fontFamily: 'var(--nb-font)', fontWeight: 600, fontSize: 13, color: '#0A0A0A', opacity: 0.5, margin: 0, maxWidth: 300, lineHeight: 1.6 }}>
                Click the <strong>+</strong> button on the left, paste your news story, and hit <strong>CONVERT ⚡</strong>
              </p>
            </div>
          </div>
        )}

        {/* ── SINGLE PANEL READER (Android Comic App Style) ── */}
        {viewMode === 'single' && hasCards && (
          <div
            className="w-full flex-1 min-h-0 flex flex-col bg-[#F0EBD8] overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Reader Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b-4 border-black bg-[#FFFBF0] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-black border-2 border-black rounded flex items-center justify-center overflow-hidden">
                  <img src="/comicGEN favicon.png" alt="Logo" className="w-[85%] h-[85%] object-contain" />
                </div>
                <span className="font-['Space_Grotesk',sans-serif] font-black text-xs sm:text-sm text-black uppercase tracking-tight">
                  ComicGEN Reader
                </span>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-1.5 bg-black p-0.5 border-2 border-black">
                <button
                  id="reader-mode-single-btn"
                  onClick={() => setViewMode('single')}
                  className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all bg-[#FFE66D] text-black shadow-[1px_1px_0px_#0A0A0A] cursor-pointer"
                >
                  <BookOpen size={13} strokeWidth={2.5} />
                  <span>Reader</span>
                </button>
                <button
                  id="reader-mode-grid-btn"
                  onClick={() => setViewMode('grid')}
                  className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all bg-black text-white hover:text-yellow-300 cursor-pointer"
                >
                  <LayoutGrid size={13} strokeWidth={2.5} />
                  <span>Grid</span>
                </button>
              </div>

              {/* Page Badge & Expand */}
              <div className="flex items-center gap-2">
                <span className="font-['Space_Grotesk',sans-serif] font-black text-[11px] bg-[#FFE66D] text-black border-2 border-black px-2 py-0.5 shadow-[2px_2px_0px_#0A0A0A]">
                  PAGE {safePanelIndex + 1} / {cards.length}
                </span>
                <button
                  onClick={() => onToggleExpand(!isExpanded)}
                  title={isExpanded ? "Collapse View" : "Expand View"}
                  className="p-1 border-2 border-black bg-white hover:bg-yellow-300 transition-colors cursor-pointer"
                >
                  {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>

            {/* Reader Main Stage: Arrows + Comic Page */}
            <div className="flex-1 min-h-0 relative flex items-center justify-between p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
              {/* Prev Button */}
              <button
                id="comic-reader-prev-btn"
                onClick={() => setActivePanelIndex(prev => Math.max(0, prev - 1))}
                disabled={safePanelIndex === 0}
                aria-label="Previous Page"
                className={`z-20 w-10 h-10 sm:w-12 sm:h-12 border-3 border-black flex items-center justify-center shrink-0 transition-all ${
                  safePanelIndex === 0
                    ? 'opacity-30 bg-zinc-200 cursor-not-allowed border-zinc-400 text-zinc-400 shadow-none'
                    : 'bg-[#FFE66D] text-black shadow-[3px_3px_0px_#0A0A0A] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#0A0A0A] active:translate-x-0 active:translate-y-0 active:shadow-none cursor-pointer'
                }`}
              >
                <ChevronLeft size={24} strokeWidth={3} />
              </button>

              {/* Single Comic Page Card */}
              <div
                className="flex-1 h-full max-w-[680px] border-4 border-black bg-black shadow-[6px_6px_0px_#0A0A0A] flex flex-col overflow-hidden relative mx-auto"
                style={{ background: '#0A0A0A' }}
              >
                {/* Comic Headline Bar */}
                <div className="bg-[#FFE66D] border-b-3 border-black px-3.5 py-2 flex items-center justify-between gap-3 shrink-0 z-10 opacity-98">
                  <span className="font-mono font-black text-xs bg-black text-[#FFE66D] px-2 py-0.5 tracking-wider uppercase shrink-0 border border-black shadow-[1px_1px_0px_rgba(0,0,0,0.3)]">
                    PAGE {safePanelIndex + 1}
                  </span>
                  <h2
                    className="font-['Bangers','Comic_Neue',cursive,sans-serif] text-sm sm:text-base md:text-lg text-black uppercase tracking-wide m-0 leading-tight flex-1 text-center font-normal"
                    style={{ letterSpacing: '0.03em' }}
                  >
                    {activeCard.headline}
                  </h2>
                </div>

                {/* Comic Artwork Viewport */}
                <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
                  {activeCard.imageUrl ? (
                    <img
                      src={activeCard.imageUrl}
                      alt={activeCard.headline || `Comic Panel ${safePanelIndex + 1}`}
                      className="w-full h-full object-contain select-none"
                      style={{ background: '#0A0A0A' }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-white p-4">
                      {activeCard.imageLoading ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-4 border-white border-t-[#FFE66D] rounded-full animate-spin" />
                          <span className="font-mono text-xs uppercase tracking-wider font-bold text-yellow-300">
                            Painting Panel {safePanelIndex + 1}...
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center">
                          <ImageOff size={32} className="text-red-400" />
                          <span className="text-red-400 font-black text-xs uppercase">IMAGE FAILED TO RENDER</span>
                          <span className="text-[10px] text-zinc-400 font-mono">{activeCard.imageError || 'NVIDIA FLUX failed'}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Speech Bubble Floating Overlay */}
                  {activeCard.speechBubble && (
                    <div
                      className={`absolute top-4 z-20 max-w-[70%] sm:max-w-[55%] pointer-events-auto ${
                        safePanelIndex % 2 === 1 ? 'left-3' : 'right-3'
                      }`}
                    >
                      <SpeechBubble text={activeCard.speechBubble} />
                    </div>
                  )}
                </div>

                {/* Comic Bottom Narration Box (High Legibility, Natural Casing, No Truncation) */}
                {(activeCard.brief1 || activeCard.brief2) && (
                  <div className="bg-[#FFFDF5] border-t-4 border-black px-4 py-3 z-10 shrink-0 max-h-[160px] overflow-y-auto">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="bg-[#FFE66D] text-black border-2 border-black text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 tracking-wider font-mono shadow-[1px_1px_0px_#0A0A0A]">
                        NARRATIVE • PANEL {safePanelIndex + 1}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {activeCard.brief1 && (
                        <p className="font-['Space_Grotesk',system-ui,sans-serif] font-bold text-xs sm:text-[14.5px] text-[#0A0A0A] leading-relaxed m-0">
                          {activeCard.brief1}
                        </p>
                      )}
                      {activeCard.brief2 && (
                        <p className="font-['Space_Grotesk',system-ui,sans-serif] font-medium text-xs sm:text-[13.5px] text-zinc-800 leading-relaxed m-0 border-l-3 border-[#FFE66D] pl-2.5">
                          {activeCard.brief2}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Next Button */}
              <button
                id="comic-reader-next-btn"
                onClick={() => setActivePanelIndex(prev => Math.min(cards.length - 1, prev + 1))}
                disabled={safePanelIndex === cards.length - 1}
                aria-label="Next Page"
                className={`z-20 w-10 h-10 sm:w-12 sm:h-12 border-3 border-black flex items-center justify-center shrink-0 transition-all ${
                  safePanelIndex === cards.length - 1
                    ? 'opacity-30 bg-zinc-200 cursor-not-allowed border-zinc-400 text-zinc-400 shadow-none'
                    : 'bg-[#FFE66D] text-black shadow-[3px_3px_0px_#0A0A0A] hover:translate-x-[2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#0A0A0A] active:translate-x-0 active:translate-y-0 active:shadow-none cursor-pointer'
                }`}
              >
                <ChevronRight size={24} strokeWidth={3} />
              </button>
            </div>

            {/* Thumbnail Scrubber Bar */}
            <div className="bg-[#FFFBF0] border-t-3 border-black px-3 py-2 flex items-center justify-center gap-2 overflow-x-auto shrink-0">
              {cards.map((c, idx) => {
                const isActive = idx === safePanelIndex
                return (
                  <button
                    key={idx}
                    id={`thumb-panel-${idx}`}
                    onClick={() => setActivePanelIndex(idx)}
                    title={`Go to Panel ${idx + 1}`}
                    className={`relative w-12 h-12 sm:w-14 sm:h-14 border-2 border-black overflow-hidden shrink-0 cursor-pointer transition-all ${
                      isActive
                        ? 'border-3 border-black ring-2 ring-[#DC2626] scale-105 shadow-[2px_2px_0px_#0A0A0A]'
                        : 'opacity-65 hover:opacity-100 hover:scale-102'
                    }`}
                    style={{ background: '#0A0A0A' }}
                  >
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-white">
                        P{idx + 1}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 bg-[#FFE66D] text-black text-[9px] font-black px-1 font-mono border-t border-l border-black">
                      {idx + 1}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── GRID VIEW ── */}
        {viewMode === 'grid' && hasCards && (
          <div style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#F0EBD8', padding: 16 }}>
            {/* Comic Page Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
              paddingBottom: 10,
              borderBottom: '4px solid #0A0A0A',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, background: '#0A0A0A', border: '2px solid #0A0A0A', borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/comicGEN favicon.png" alt="Logo" style={{ width: '90%', height: '90%', objectFit: 'contain' }} />
                </div>
                <span style={{ fontFamily: 'var(--nb-font)', fontWeight: 900, fontSize: 15, color: '#0A0A0A', letterSpacing: '-0.3px' }}>
                  ComicGEN • Grid Overview
                </span>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-1.5 bg-black p-0.5 border-2 border-black">
                <button
                  id="grid-mode-single-btn"
                  onClick={() => setViewMode('single')}
                  className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all bg-black text-white hover:text-yellow-300 cursor-pointer"
                >
                  <BookOpen size={13} strokeWidth={2.5} />
                  <span>Reader</span>
                </button>
                <button
                  id="grid-mode-grid-btn"
                  onClick={() => setViewMode('grid')}
                  className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all bg-[#FFE66D] text-black shadow-[1px_1px_0px_#0A0A0A] cursor-pointer"
                >
                  <LayoutGrid size={13} strokeWidth={2.5} />
                  <span>Grid</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span style={{
                  fontFamily: 'var(--nb-font)', fontWeight: 900, fontSize: 11,
                  background: '#FFE66D', color: '#0A0A0A',
                  border: '2px solid #0A0A0A',
                  borderRadius: 4, padding: '3px 10px',
                }}>
                  {cards.length} PANELS
                </span>
                <button
                  onClick={() => onToggleExpand(!isExpanded)}
                  title={isExpanded ? "Collapse View" : "Expand View"}
                  className="p-1 border-2 border-black bg-white hover:bg-yellow-300 transition-colors cursor-pointer"
                >
                  {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>

            {/* Dynamic Layout Engine */}
            <div style={{
              background: '#F0EBD8',
              border: '4px solid #0A0A0A',
              borderRadius: 0,
              boxShadow: '5px 5px 0px #0A0A0A',
              padding: 8,
              position: 'relative',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}>
              {(() => {
                // ── Panel renderer — safe fallback if idx out of range ───────────────────
                const P = (idx: number, cls = '', extraStyle: React.CSSProperties = {}) => {
                  const card = cards[idx]
                  if (!card) return null
                  return (
                    <div
                      key={idx}
                      className={`relative overflow-hidden border-4 border-black bg-black cursor-pointer group flex flex-col ${cls}`}
                      style={extraStyle}
                      onClick={() => { setActivePanelIndex(idx); setViewMode('single'); }}
                    >
                      {/* Image — absolutely fills the entire panel cell */}
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.headline || `Panel ${idx + 1}`}
                          className="absolute inset-0 w-full h-full object-contain z-0"
                          style={{ background: '#0A0A0A' }}
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-zinc-900 text-xs font-black text-white opacity-40 font-mono z-0">
                          {card.imageLoading ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-6 h-6 border-2 border-white border-t-yellow-400 rounded-full animate-spin" />
                              <span>P{idx + 1}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-center px-2">
                              <span className="text-red-400 font-bold text-[10px]">IMAGE ERROR</span>
                              <span className="text-[8px] text-zinc-400">{card.imageError || 'NVIDIA FLUX failed'}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Headline badge — compact top banner */}
                      <div className="absolute top-0 left-0 w-full z-10 bg-yellow-400 border-b-2 border-black px-2 py-0.5 opacity-95">
                        <p className="font-bold text-[9px] sm:text-[10px] text-black uppercase truncate tracking-wider m-0" style={{ fontFamily: "'Bangers', 'Comic Neue', cursive, sans-serif" }}>
                          P{idx + 1}: {card.headline}
                        </p>
                      </div>
                      {/* SpeechBubble — strategically anchored to top-left or top-right side corner */}
                      {card.speechBubble && (
                        <div className={`absolute top-6 z-20 max-w-[55%] sm:max-w-[50%] ${idx % 2 === 1 ? 'left-2' : 'right-2'}`}>
                          <SpeechBubble text={card.speechBubble} />
                        </div>
                      )}
                      {/* Caption strip — compact bottom strip */}
                      {(card.brief1 || card.brief2) && (
                        <div className="absolute bottom-0 left-0 w-full z-10 bg-[#FFE66D] border-t-2 border-black px-2 py-0.5 opacity-95">
                          <p className="font-bold text-[8px] sm:text-[9px] text-black line-clamp-2 leading-tight uppercase m-0" style={{ fontFamily: "'Comic Neue', cursive, sans-serif", fontWeight: 700 }}>
                            {card.brief1} {card.brief2 ? `• ${card.brief2}` : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                }

                // ── Global wrapper style (Neobrutalist outer frame) ───────────────────────
                // flex-1 + min-h-0 ensures the wrapper expands to fill remaining space in the flex column
                const W = 'flex-1 w-full min-h-0 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'

                switch (activeLayoutId) {

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 1 — Pop-Art Angled 5-Panel
                  // Row 1: 2 angled panels | Row 2: 2 panels | Row 3: full-width
                  // ══════════════════════════════════════════════════════════════════
                  case 1:
                    return (
                      <div className={`${W} bg-yellow-400 p-2 grid grid-cols-2 gap-2 h-full`} style={{ gridTemplateRows: '1fr 1fr 1fr' }}>
                        {/* Row 1 – left */}
                        {P(0, 'h-full [clip-path:polygon(0_0,100%_0,95%_100%,0_100%)]')}
                        {/* Row 1 – right */}
                        {P(1, 'h-full [clip-path:polygon(5%_0,100%_0,100%_100%,0_100%)]')}
                        {/* Row 2 */}
                        {P(2, 'h-full')}
                        {P(3, 'h-full')}
                        {/* Row 3 */}
                        {P(4, 'col-span-2 h-full')}
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 2 — Red Hero 3-Panel
                  // Row 1: wide hero banner | Row 2: 2 equal squares
                  // ══════════════════════════════════════════════════════════════════
                  case 2:
                    return (
                      <div className={`${W} bg-[#E53935] p-2 grid grid-cols-2 gap-2 h-full`} style={{ gridTemplateRows: '1.2fr 1fr' }}>
                        {P(0, 'col-span-2 h-full')}
                        {P(1, 'col-span-1 h-full')}
                        {P(2, 'col-span-1 h-full')}
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 3 — Vertical 3-Strip
                  // 3 equal tall panels side-by-side
                  // ══════════════════════════════════════════════════════════════════
                  case 3:
                    return (
                      <div className={`${W} bg-black p-2 grid grid-cols-3 gap-2 h-full`}>
                        {P(0, 'h-full')}
                        {P(1, 'h-full')}
                        {P(2, 'h-full')}
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 4 — Classic 5-Panel Grid
                  // 2 top | 1 center wide | 2 bottom
                  // ══════════════════════════════════════════════════════════════════
                  case 4:
                    return (
                      <div className={`${W} bg-white p-2 grid grid-cols-2 gap-2 h-full`} style={{ gridTemplateRows: '1fr 1fr 1fr' }}>
                        {P(0, 'col-span-1 h-full')}
                        {P(1, 'col-span-1 h-full')}
                        {P(2, 'col-span-2 h-full')}
                        {P(3, 'col-span-1 h-full')}
                        {P(4, 'col-span-1 h-full')}
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 5 — Diagonal Slash 3-Panel
                  // 3 horizontal panels with harsh diagonal clip-path cuts
                  // ══════════════════════════════════════════════════════════════════
                  case 5:
                    return (
                      <div className={`${W} bg-blue-500 p-2 flex flex-col gap-0 h-full`}>
                        {/* Top panel — diagonal bottom edge */}
                        {P(0, 'flex-1 h-full [clip-path:polygon(0_0,100%_0,100%_75%,0_100%)] mb-[-12px]')}
                        {/* Middle panel — diagonal top & bottom */}
                        {P(1, 'flex-1 h-full [clip-path:polygon(0_15%,100%_0,100%_85%,0_100%)] my-[-6px] z-10')}
                        {/* Bottom panel — diagonal top edge */}
                        {P(2, 'flex-1 h-full [clip-path:polygon(0_25%,100%_0,100%_100%,0_100%)] mt-[-12px]')}
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 6 — Y-Split 3-Panel
                  // Row 1: 2 side-by-side | Row 2: 1 full-width bottom
                  // ══════════════════════════════════════════════════════════════════
                  case 6:
                    return (
                      <div className={`${W} bg-purple-500 p-2 grid grid-cols-2 grid-rows-2 gap-2 h-full`}>
                        {P(0, 'col-span-1 row-span-1 h-full')}
                        {P(1, 'col-span-1 row-span-1 h-full')}
                        {P(2, 'col-span-2 row-span-1 h-full')}
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 7 — Dynamic Angled 4-Panel
                  // 4 shattered-trapezoid panels with aggressive clip-paths
                  // ══════════════════════════════════════════════════════════════════
                  case 7:
                    return (
                      <div className={`${W} bg-white p-2 grid grid-cols-2 gap-2 h-full`}>
                        {P(0, 'h-full [clip-path:polygon(0_0,100%_0,90%_100%,0_100%)]')}
                        {P(1, 'h-full [clip-path:polygon(10%_0,100%_0,100%_100%,0_100%)]')}
                        {P(2, 'h-full [clip-path:polygon(0_0,100%_0,100%_100%,10%_100%)]')}
                        {P(3, 'h-full [clip-path:polygon(0_0,90%_0,100%_100%,0_100%)]')}
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 8 — Lightning Bolt 2-Panel
                  // Left & right panels with jagged bolt-shaped clip-paths
                  // ══════════════════════════════════════════════════════════════════
                  case 8:
                    return (
                      <div className={`${W} bg-black p-2 flex gap-2 h-full`}>
                        {P(0, 'flex-1 h-full [clip-path:polygon(0_0,100%_0,80%_40%,100%_40%,70%_100%,0_100%)]')}
                        {P(1, 'flex-1 h-full [clip-path:polygon(100%_0,100%_100%,0_100%,30%_60%,0_60%,20%_0)]')}
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 9 — Action Burst 5-Panel
                  // 4 corner panels + 1 center starburst absolute panel
                  // ══════════════════════════════════════════════════════════════════
                  case 9:
                    return (
                      <div className={`${W} bg-orange-500 p-2 grid grid-cols-3 grid-rows-3 gap-2 relative h-full`}>
                        {/* Corners */}
                        {P(0, 'col-span-1 row-span-1 h-full')}
                        {P(1, 'col-start-3 col-span-1 row-span-1 h-full')}
                        {P(2, 'col-span-1 row-start-3 row-span-1 h-full')}
                        {P(3, 'col-start-3 row-start-3 col-span-1 row-span-1 h-full')}
                        {/* Center starburst */}
                        {cards[4] && (
                          <div
                            key={4}
                            className="absolute border-4 border-black bg-zinc-900 overflow-hidden cursor-pointer z-20 [clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)]"
                            style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '42%', height: '42%' }}
                            onClick={() => { setActivePanelIndex(4); setViewMode('single'); onToggleExpand(false) }}
                          >
                            {cards[4].imageUrl
                              ? <img src={cards[4].imageUrl} alt={cards[4].headline} className="w-full h-full object-contain bg-zinc-900" />
                              : <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-white opacity-40">P5</div>
                            }
                          </div>
                        )}
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 10 — Left-Heavy 3-Panel
                  // Left: tall hero | Right: 2 stacked squares
                  // ══════════════════════════════════════════════════════════════════
                  case 10:
                    return (
                      <div className={`${W} bg-green-400 p-2 grid grid-cols-2 gap-2 h-full`}>
                        {P(0, 'row-span-2 h-full')}
                        <div className="flex flex-col gap-2 h-full">
                          {P(1, 'flex-1 h-full')}
                          {P(2, 'flex-1 h-full')}
                        </div>
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 11 — Cinematic 3-Banner Stack
                  // 3 horizontal film-strip panels
                  // ══════════════════════════════════════════════════════════════════
                  case 11:
                    return (
                      <div className={`${W} bg-zinc-900 p-2 flex flex-col gap-2 h-full`}>
                        {P(0, 'w-full flex-1 h-full')}
                        {P(1, 'w-full flex-1 h-full')}
                        {P(2, 'w-full flex-1 h-full')}
                      </div>
                    )

                  // ══════════════════════════════════════════════════════════════════
                  // Layout 12 — Bottom-Burst 3-Panel
                  // Top: 1 wide panel | Bottom: 2 panels with V-point center angles
                  // ══════════════════════════════════════════════════════════════════
                  case 12:
                    return (
                      <div className={`${W} bg-white p-2 grid grid-cols-2 gap-2 h-full`} style={{ gridTemplateRows: '1fr 1fr' }}>
                        {P(0, 'col-span-2 h-full')}
                        {P(1, 'col-span-1 h-full [clip-path:polygon(0_0,100%_0,100%_100%,50%_70%,0_100%)]')}
                        {P(2, 'col-span-1 h-full [clip-path:polygon(0_0,100%_0,100%_100%,50%_70%,0_100%)]')}
                      </div>
                    )

                  default:
                    return (
                      <div className={`${W} bg-white p-2 grid grid-cols-2 gap-2 h-full`}>
                        {cards.map((_, i) => P(i, 'h-full'))}
                      </div>
                    )
                }
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── Action Bar: Translate + Download + Share ── */}
      <div className="flex items-center justify-center gap-3 w-full mt-4 flex-wrap z-30">
        {/* Language picker + Translate button */}
        <div className="inline-flex items-center">
          <select
            value={selectedLanguage}
            onChange={e => setSelectedLanguage(e.target.value)}
            disabled={!hasCards || isTranslating}
            className="bg-white text-black border-4 border-black border-r-0 px-3 py-2 uppercase font-bold font-['Oswald'] tracking-wider rounded-none cursor-pointer outline-none h-[44px] text-sm"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            {LANGUAGE_OPTIONS.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>

          <button
            id="nb-translate-btn"
            onClick={handleTranslateClick}
            disabled={!hasCards || isTranslating}
            className={`bg-white text-black border-4 border-black px-6 py-2 uppercase font-black italic font-['Oswald'] tracking-wider inline-flex items-center justify-center rounded-none h-[44px] ${
              isTranslating
                ? 'shadow-none translate-y-1 translate-x-1 cursor-not-allowed'
                : 'shadow-[4px_4px_0px_0px_#ec4899] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all cursor-pointer'
            }`}
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-black stroke-[3]" />
                <span>TRANSLATING...</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-2 stroke-[3]" />
                <span>TRANSLATE</span>
              </>
            )}
          </button>
        </div>

        {/* Download Card Button */}
        <button
          id="nb-download-btn"
          onClick={() => onDownload(safePanelIndex)}
          disabled={!activeCard?.imageUrl}
          className={`bg-white text-black border-4 border-black px-6 py-2 uppercase font-black italic font-['Oswald'] tracking-wider inline-flex items-center justify-center rounded-none h-[44px] ${
            !activeCard?.imageUrl
              ? 'opacity-40 cursor-not-allowed shadow-none'
              : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all cursor-pointer'
          }`}
          style={{ fontFamily: "'Oswald', sans-serif" }}
        >
          <Download className="w-4 h-4 mr-2 stroke-[3]" />
          <span>DOWNLOAD PANEL {safePanelIndex + 1}</span>
        </button>

        {/* Share Button */}
        <button
          id="nb-share-btn"
          onClick={handleShareClick}
          disabled={!hasCards}
          className={`bg-white text-black border-4 border-black px-6 py-2 uppercase font-black italic font-['Oswald'] tracking-wider inline-flex items-center justify-center rounded-none h-[44px] ${
            !hasCards
              ? 'opacity-40 cursor-not-allowed shadow-none'
              : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all cursor-pointer'
          }`}
          style={{ fontFamily: "'Oswald', sans-serif" }}
        >
          <Share2 className="w-4 h-4 mr-2 stroke-[3]" />
          <span>{copiedShare ? 'LINK COPIED!' : 'SHARE'}</span>
        </button>
      </div>
    </div>
  )
}
