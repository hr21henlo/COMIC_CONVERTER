'use client'

import { Clock, Share2, Download, Info } from 'lucide-react'

interface NavbarProps {
  timerSeconds: number
  isTimerRunning: boolean
  onOpenAbout: () => void
  onOpenHistory: () => void
  onDownloadAll?: () => void
}

export function Navbar({
  timerSeconds,
  isTimerRunning,
  onOpenAbout,
  onOpenHistory,
  onDownloadAll,
}: NavbarProps) {
  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return (
    <header className="sticky top-0 z-40 w-full">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '10px 18px',
          background: '#FFFBF0',
          borderBottom: '3px solid #0A0A0A',
          boxShadow: '0 4px 0px #0A0A0A',
          fontFamily: 'var(--nb-font)',
          minHeight: 64,
        }}
      >

        {/* ── Right: Timer + Actions ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Timer Display */}
          <div
            id="nb-timer-display"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 14px',
              background: isTimerRunning ? '#0A0A0A' : '#FFFFFF',
              border: '3px solid #0A0A0A',
              borderRadius: 8,
              boxShadow: isTimerRunning ? 'none' : '3px 3px 0px #0A0A0A',
              transition: 'all 0.2s ease',
              transform: isTimerRunning ? 'translate(3px, 3px)' : 'translate(0,0)',
            }}
          >
            <Clock
              size={15}
              strokeWidth={3}
              color={isTimerRunning ? '#FFE66D' : '#0A0A0A'}
              style={{ animation: isTimerRunning ? 'spin 2s linear infinite' : 'none' }}
            />
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 900,
                fontSize: 16,
                color: isTimerRunning ? '#FFE66D' : '#0A0A0A',
                letterSpacing: '0.05em',
                minWidth: 48,
              }}
            >
              {formatTimer(timerSeconds)}
            </span>
          </div>

          {/* History Button */}
          <NavButton id="nb-history-btn" onClick={onOpenHistory} title="History" color="#9B5DE5" textColor="#FFFFFF">
            <span style={{ fontFamily: 'var(--nb-font)', fontWeight: 800, fontSize: 12, letterSpacing: '0.05em' }}>HISTORY</span>
          </NavButton>

          {/* About Button */}
          <NavButton id="nb-about-btn" onClick={onOpenAbout} title="About" color="#FFFFFF" textColor="#0A0A0A">
            <Info size={16} strokeWidth={3} color="#0A0A0A" />
          </NavButton>

          {/* Download All Button */}
          {onDownloadAll && (
            <NavButton id="nb-download-all-btn" onClick={onDownloadAll} title="Download" color="#06D6A0" textColor="#0A0A0A">
              <Download size={16} strokeWidth={3} color="#0A0A0A" />
            </NavButton>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Nav Button helper ────────────────────────────────────────────────────────
function NavButton({
  id,
  onClick,
  title,
  color,
  textColor,
  children,
}: {
  id: string
  onClick: () => void
  title: string
  color: string
  textColor: string
  children: React.ReactNode
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '7px 12px',
        background: color,
        color: textColor,
        border: '3px solid #0A0A0A',
        borderRadius: 8,
        boxShadow: '3px 3px 0px #0A0A0A',
        cursor: 'pointer',
        fontFamily: 'var(--nb-font)',
        fontWeight: 800,
        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
        height: 40,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translate(-2px, -2px)'
        el.style.boxShadow = '5px 5px 0px #0A0A0A'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translate(0, 0)'
        el.style.boxShadow = '3px 3px 0px #0A0A0A'
      }}
      onMouseDown={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translate(3px, 3px)'
        el.style.boxShadow = 'none'
      }}
      onMouseUp={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translate(-2px, -2px)'
        el.style.boxShadow = '5px 5px 0px #0A0A0A'
      }}
    >
      {children}
    </button>
  )
}
