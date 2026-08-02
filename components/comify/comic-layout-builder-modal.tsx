'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  X,
  LayoutGrid,
  Check,
  Save,
  Palette,
  RefreshCw,
} from 'lucide-react'

export interface CustomComicLayout {
  id: string
  name: string
  numPanels: number
  gridPreset: string
  borderThickness: number
  borderStyle: 'solid' | 'hand-drawn' | 'dashed' | 'double'
  borderColor: string
  backgroundColor: string
  panelFillColor: string
  panelGap: number
  panelSkew: number
  timestamp: number
}

interface ComicLayoutBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveLayout?: (layout: CustomComicLayout) => void
}

// ─── Comic word art decorations per panel index ─────────────────────────────
const COMIC_WORDS = ['POW!', 'ZAP!', 'BOOM!', 'ZOOM!', 'BAM!', 'WOW!']
const PANEL_COLORS_DEFAULT = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bcd', '#c77dff']

// ─── Halftone SVG background ────────────────────────────────────────────────
function HalftoneDot({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return <circle cx={x} cy={y} r={r} fill={color} opacity={0.18} />
}

function HalftonePattern({ width, height, color }: { width: number; height: number; color: string }) {
  const dots = []
  const gap = 18
  for (let row = 0; row * gap < height; row++) {
    for (let col = 0; col * gap < width; col++) {
      const x = col * gap + (row % 2 === 0 ? 0 : gap / 2)
      const y = row * gap
      dots.push(<HalftoneDot key={`${row}-${col}`} x={x} y={y} r={3.5} color={color} />)
    }
  }
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {dots}
    </svg>
  )
}

// ─── Panel renderers for each preset ────────────────────────────────────────
function renderPanel(
  idx: number,
  label: string,
  borderThickness: number,
  borderStyle: string,
  borderColor: string,
  fillColor: string,
  skew: number,
  extraStyle?: React.CSSProperties
) {
  const bStyle = borderStyle === 'hand-drawn' ? 'solid' : borderStyle
  const wordColor = '#222'
  const word = COMIC_WORDS[idx % COMIC_WORDS.length]
  return (
    <div
      key={label}
      style={{
        borderWidth: `${borderThickness}px`,
        borderColor,
        borderStyle: bStyle as any,
        backgroundColor: fillColor,
        transform: skew !== 0 ? `skewX(${skew}deg)` : undefined,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...extraStyle,
      }}
    >
      {/* Halftone dots pattern inside panel */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.22, pointerEvents: 'none' }}
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
      >
        {[...Array(6)].map((_, r) =>
          [...Array(6)].map((_, c) => (
            <circle
              key={`${r}${c}`}
              cx={c * 40 + (r % 2 === 0 ? 0 : 20)}
              cy={r * 40}
              r={6}
              fill={borderColor}
            />
          ))
        )}
      </svg>
      {/* Comic word art */}
      <span
        style={{
          fontFamily: 'Impact, "Arial Black", sans-serif',
          fontSize: 'clamp(9px, 1.8vw, 14px)',
          fontWeight: 900,
          color: wordColor,
          letterSpacing: '0.05em',
          textShadow: `2px 2px 0 ${borderColor}`,
          userSelect: 'none',
          transform: skew !== 0 ? `skewX(${-skew}deg)` : undefined,
          zIndex: 1,
          position: 'relative',
        }}
      >
        {word}
      </span>
    </div>
  )
}

// ─── Layout preset definitions ───────────────────────────────────────────────
const GRID_PRESETS = [
  { id: '3-vertical',    label: '3-Panel Vertical Strip',  count: 3,  icon: '▬▬▬' },
  { id: '3-diagonal',    label: '3-Panel Diagonal Slash',  count: 3,  icon: '⟋⟋⟋' },
  { id: '4-grid',        label: '4-Panel 2×2 Grid',        count: 4,  icon: '⊞' },
  { id: '5-asymmetric',  label: '5-Panel Asymmetrical',    count: 5,  icon: '▬▬+▬▬▬' },
  { id: '5-action',      label: '5-Panel Action Burst',    count: 5,  icon: '✦' },
  { id: '6-classic',     label: '6-Panel Newsprint',       count: 6,  icon: '⊟⊟⊟' },
]

export function ComicLayoutBuilderModal({ isOpen, onClose, onSaveLayout }: ComicLayoutBuilderModalProps) {
  const [layoutName, setLayoutName] = useState('My Custom Layout')
  const [gridPreset, setGridPreset] = useState<string>('5-asymmetric')
  const [numPanels, setNumPanels] = useState<number>(5)
  const [borderThickness, setBorderThickness] = useState<number>(4)
  const [borderStyle, setBorderStyle] = useState<'solid' | 'hand-drawn' | 'dashed' | 'double'>('solid')
  const [borderColor, setBorderColor] = useState<string>('#111111')
  const [backgroundColor, setBackgroundColor] = useState<string>('#faf8ef')
  const [panelFillColor, setPanelFillColor] = useState<string>('#ffffff')
  const [panelGap, setPanelGap] = useState<number>(10)
  const [panelSkew, setPanelSkew] = useState<number>(0)
  const [savedSuccess, setSavedSuccess] = useState(false)

  if (!isOpen) return null

  const handleSave = () => {
    const layout: CustomComicLayout = {
      id: `layout-${Date.now()}`,
      name: layoutName || `Custom ${numPanels}-Panel Layout`,
      numPanels,
      gridPreset,
      borderThickness,
      borderStyle,
      borderColor,
      backgroundColor,
      panelFillColor,
      panelGap,
      panelSkew,
      timestamp: Date.now(),
    }

    const stored = localStorage.getItem('comicgen_custom_layouts')
    const list: CustomComicLayout[] = stored ? JSON.parse(stored) : []
    const updated = [layout, ...list]
    localStorage.setItem('comicgen_custom_layouts', JSON.stringify(updated))

    if (onSaveLayout) onSaveLayout(layout)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  // ── Inline SVG diagonal separator for diagonal presets ──
  function DiagonalCanvas({ count }: { count: number }) {
    const gap = panelGap
    // 3-diagonal: 3 panels divided by two diagonal slashes
    const fills = [panelFillColor, backgroundColor, panelFillColor]
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 500"
        style={{ display: 'block', borderRadius: 12 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background */}
        <rect width="400" height="500" fill={backgroundColor} />
        {/* Panel 1 */}
        <polygon points="0,0 400,0 330,500 0,500" fill={panelFillColor} stroke={borderColor} strokeWidth={borderThickness} />
        {/* Panel 2 middle sliver */}
        <polygon points="330,0 400,0 400,500 330,500" fill={backgroundColor} stroke={borderColor} strokeWidth={borderThickness / 2} />
        {/* Panel 3 */}
        <polygon points="330,0 400,0 400,180 330,180" fill={panelFillColor} stroke={borderColor} strokeWidth={borderThickness} />
        {/* Word art overlays */}
        <text x="120" y="260" fontFamily="Impact, Arial Black" fontWeight="900" fontSize="28" fill={borderColor} opacity="0.5" textAnchor="middle">POW!</text>
        <text x="330" y="100" fontFamily="Impact, Arial Black" fontWeight="900" fontSize="18" fill={borderColor} opacity="0.5" textAnchor="middle" transform="rotate(-20 330 100)">ZAP!</text>
        {/* Halftone dots */}
        {[...Array(5)].map((_, r) =>
          [...Array(5)].map((_, c) => (
            <circle key={`ht-${r}-${c}`} cx={c * 70 + 25} cy={r * 90 + 30} r={5} fill={borderColor} opacity={0.12} />
          ))
        )}
      </svg>
    )
  }

  function ActionBurstCanvas() {
    // 5 panels in a dynamic angled action burst layout
    const sw = borderThickness
    const sc = borderColor
    const fc = panelFillColor
    const bc = backgroundColor
    return (
      <svg width="100%" height="100%" viewBox="0 0 400 520" style={{ display: 'block', borderRadius: 12 }} preserveAspectRatio="xMidYMid meet">
        <rect width="400" height="520" fill={bc} />
        {/* Panel 1: top-left large */}
        <polygon points="0,0 230,0 210,250 0,270" fill={fc} stroke={sc} strokeWidth={sw} />
        {/* Panel 2: top-right */}
        <polygon points="230,0 400,0 400,230 215,250" fill={bc === '#faf8ef' ? '#fffbe8' : fc} stroke={sc} strokeWidth={sw} />
        {/* Panel 3: wide center strip angled */}
        <polygon points="0,270 210,250 400,230 400,310 220,330 0,360" fill={fc === '#ffffff' ? '#f0fffe' : panelFillColor} stroke={sc} strokeWidth={sw} />
        {/* Panel 4: bottom-left */}
        <polygon points="0,360 220,330 200,520 0,520" fill={bc === '#faf8ef' ? '#fef9ee' : fc} stroke={sc} strokeWidth={sw} />
        {/* Panel 5: bottom-right */}
        <polygon points="220,330 400,310 400,520 200,520" fill={fc} stroke={sc} strokeWidth={sw} />
        {/* Comic word art */}
        <text x="100" y="140" fontFamily="Impact, Arial Black" fontWeight="900" fontSize="26" fill={sc} opacity="0.45" textAnchor="middle" transform="rotate(-8 100 140)">POW!</text>
        <text x="320" y="120" fontFamily="Impact, Arial Black" fontWeight="900" fontSize="22" fill={sc} opacity="0.4" textAnchor="middle" transform="rotate(10 320 120)">ZAP!</text>
        <text x="200" y="295" fontFamily="Impact, Arial Black" fontWeight="900" fontSize="20" fill={sc} opacity="0.35" textAnchor="middle">ZOOM!</text>
        <text x="90" y="440" fontFamily="Impact, Arial Black" fontWeight="900" fontSize="20" fill={sc} opacity="0.4" textAnchor="middle" transform="rotate(-5 90 440)">BAM!</text>
        <text x="310" y="430" fontFamily="Impact, Arial Black" fontWeight="900" fontSize="20" fill={sc} opacity="0.4" textAnchor="middle" transform="rotate(5 310 430)">WOW!</text>
        {/* Halftone dots */}
        {[...Array(4)].map((_, r) =>
          [...Array(5)].map((_, c) => (
            <circle key={`ht-${r}-${c}`} cx={c * 80 + 20} cy={r * 120 + 40} r={6} fill={sc} opacity={0.1} />
          ))
        )}
      </svg>
    )
  }

  // ── Main canvas rendering ──────────────────────────────────────────────────
  function renderCanvas() {
    const gap = panelGap
    const pStyle: React.CSSProperties = {
      borderRadius: 8,
      flex: 1,
      minWidth: 0,
      minHeight: 0,
    }

    if (gridPreset === '3-diagonal') {
      return <DiagonalCanvas count={3} />
    }

    if (gridPreset === '5-action') {
      return <ActionBurstCanvas />
    }

    if (gridPreset === '3-vertical') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap, width: '100%', height: '100%' }}>
          {[0, 1, 2].map((i) =>
            renderPanel(i, `Panel ${i + 1}`, borderThickness, borderStyle, borderColor, panelFillColor, panelSkew, pStyle)
          )}
        </div>
      )
    }

    if (gridPreset === '4-grid') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap, width: '100%', height: '100%' }}>
          {[0, 1, 2, 3].map((i) =>
            renderPanel(i, `Panel ${i + 1}`, borderThickness, borderStyle, borderColor, panelFillColor, panelSkew, pStyle)
          )}
        </div>
      )
    }

    if (gridPreset === '5-asymmetric') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap, width: '100%', height: '100%' }}>
          <div style={{ display: 'flex', gap, flex: 1 }}>
            {renderPanel(0, 'Panel 1', borderThickness, borderStyle, borderColor, panelFillColor, panelSkew, { ...pStyle, flex: 2 })}
            {renderPanel(1, 'Panel 2', borderThickness, borderStyle, borderColor, panelFillColor, panelSkew, { ...pStyle, flex: 1 })}
          </div>
          <div style={{ display: 'flex', gap, flex: 1 }}>
            {renderPanel(2, 'Panel 3', borderThickness, borderStyle, borderColor, panelFillColor, panelSkew, pStyle)}
            {renderPanel(3, 'Panel 4', borderThickness, borderStyle, borderColor, panelFillColor, panelSkew, pStyle)}
            {renderPanel(4, 'Panel 5', borderThickness, borderStyle, borderColor, panelFillColor, panelSkew, pStyle)}
          </div>
        </div>
      )
    }

    if (gridPreset === '6-classic') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap, width: '100%', height: '100%' }}>
          {[0, 1, 2, 3, 4, 5].map((i) =>
            renderPanel(i, `Panel ${i + 1}`, borderThickness, borderStyle, borderColor, panelFillColor, panelSkew, pStyle)
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', padding: 16, backdropFilter: 'blur(4px)' }}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '96vh',
          width: '100%',
          maxWidth: 1100,
          overflow: 'hidden',
          background: '#FFFBF0',
          border: '3px solid #0A0A0A',
          borderRadius: 16,
          boxShadow: '8px 8px 0px #0A0A0A',
          fontFamily: 'var(--nb-font, \'Space Grotesk\', system-ui, sans-serif)',
        }}
      >
        {/* NB Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '3px solid #0A0A0A',
            padding: '14px 22px',
            background: '#4361EE',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#FFE66D',
                border: '3px solid #0A0A0A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '3px 3px 0px #0A0A0A',
              }}
            >
              <LayoutGrid size={20} color="#0A0A0A" strokeWidth={2.5} />
            </div>
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 900, margin: 0, color: '#FFFFFF', letterSpacing: '-0.3px' }}>Layout Builder & Store</h2>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 600 }}>Design panel layouts — angles, colors & sizes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#0A0A0A',
              border: '2px solid #0A0A0A',
              color: '#FFE66D',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '3px 3px 0px rgba(0,0,0,0.3)',
              transition: 'transform 0.08s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <X size={16} color="#FFE66D" strokeWidth={3} />
          </button>
        </div>

        {/* Builder Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px',
            display: 'grid',
            gridTemplateColumns: '1fr 1.4fr',
            gap: 18,
            scrollbarWidth: 'none',
          }}
        >
          {/* ── Left Controls ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

            {/* Layout Name */}
            <div>
              <label style={{ fontFamily: 'var(--nb-font)', fontSize: 11, fontWeight: 800, color: '#0A0A0A', display: 'block', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Layout Title:
              </label>
              <input
                type="text"
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                style={{
                  width: '100%',
                  borderRadius: 6,
                  border: '3px solid #0A0A0A',
                  background: '#FFFFFF',
                  padding: '8px 12px',
                  fontSize: 14,
                  fontFamily: 'var(--nb-font)',
                  fontWeight: 700,
                  color: '#0A0A0A',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '3px 3px 0px #0A0A0A',
                }}
              />
            </div>

            {/* Grid Presets */}
            <div>
              <label style={{ fontFamily: 'var(--nb-font)', fontSize: 11, fontWeight: 800, color: '#0A0A0A', display: 'block', marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Panel Layout Preset:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {GRID_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setGridPreset(preset.id)
                      setNumPanels(preset.count)
                    }}
                    style={{
                      borderRadius: 6,
                      border: `3px solid #0A0A0A`,
                      background: gridPreset === preset.id ? '#0A0A0A' : '#FFFFFF',
                      color: gridPreset === preset.id ? '#FFE66D' : '#0A0A0A',
                      padding: '8px 10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: gridPreset === preset.id ? 'none' : '3px 3px 0px #0A0A0A',
                      transform: gridPreset === preset.id ? 'translate(3px,3px)' : 'translate(0,0)',
                      fontFamily: 'var(--nb-font)',
                      transition: 'all 0.08s',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800 }}>{preset.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>{preset.count} Panels</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Styling */}
            <div
              style={{
                background: '#F0EBD8',
                borderRadius: 10,
                border: '3px solid #0A0A0A',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '3px 3px 0px #0A0A0A',
              }}
            >
              <div style={{ fontFamily: 'var(--nb-font)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0A0A0A' }}>
                Frame Styling
              </div>

              {/* Border Thickness */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--nb-font)', fontSize: 11, color: '#0A0A0A', marginBottom: 4, fontWeight: 700 }}>
                  <span>Border Thickness</span><span style={{ color: '#4361EE', fontWeight: 900 }}>{borderThickness}px</span>
                </div>
                <input type="range" min="1" max="16" value={borderThickness}
                  onChange={(e) => setBorderThickness(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#4361EE' }} />
              </div>

              {/* Panel Gap */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--nb-font)', fontSize: 11, color: '#0A0A0A', marginBottom: 4, fontWeight: 700 }}>
                  <span>Panel Gap / Margin</span><span style={{ color: '#4361EE', fontWeight: 900 }}>{panelGap}px</span>
                </div>
                <input type="range" min="2" max="32" value={panelGap}
                  onChange={(e) => setPanelGap(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#4361EE' }} />
              </div>

              {/* Panel Skew/Angle */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--nb-font)', fontSize: 11, color: '#0A0A0A', marginBottom: 4, fontWeight: 700 }}>
                  <span>Panel Angle / Skew</span>
                  <span style={{ color: '#FF6B6B', fontWeight: 900 }}>{panelSkew}°</span>
                </div>
                <input type="range" min="-25" max="25" value={panelSkew}
                  onChange={(e) => setPanelSkew(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#FF6B6B' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--nb-font)', fontSize: 9, color: '#0A0A0A', marginTop: 2, opacity: 0.5 }}>
                  <span>-25° left</span><span>0° normal</span><span>+25° right</span>
                </div>
              </div>

              {/* Border Style */}
              <div>
                <div style={{ fontFamily: 'var(--nb-font)', fontSize: 11, color: '#0A0A0A', marginBottom: 6, fontWeight: 700 }}>Border Style:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[
                    { id: 'solid', label: 'Solid' },
                    { id: 'hand-drawn', label: 'Ink' },
                    { id: 'dashed', label: 'Dash' },
                    { id: 'double', label: 'Double' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setBorderStyle(st.id as any)}
                      style={{
                        borderRadius: 6,
                        padding: '6px 0',
                        fontSize: 10,
                        fontFamily: 'var(--nb-font)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: '2px solid #0A0A0A',
                        background: borderStyle === st.id ? '#0A0A0A' : '#FFFFFF',
                        color: borderStyle === st.id ? '#FFE66D' : '#0A0A0A',
                        boxShadow: borderStyle === st.id ? 'none' : '2px 2px 0px #0A0A0A',
                        transition: 'all 0.08s',
                      }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Color Pickers ── */}
            <div
              style={{
                background: '#F0EBD8',
                borderRadius: 10,
                border: '3px solid #0A0A0A',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '3px 3px 0px #0A0A0A',
              }}
            >
              <div style={{ fontFamily: 'var(--nb-font)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0A0A0A' }}>
                Colours
              </div>

              {/* Border Color */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--nb-font)', fontSize: 12, fontWeight: 700, color: '#0A0A0A' }}>Border Color</span>
                <label style={{ position: 'relative', cursor: 'pointer' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      border: '3px solid #0A0A0A',
                      background: borderColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '3px 3px 0px #0A0A0A',
                      overflow: 'hidden',
                    }}
                  />
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Panel Fill Color */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--nb-font)', fontSize: 12, fontWeight: 700, color: '#0A0A0A' }}>Panel Fill Color</span>
                <label style={{ position: 'relative', cursor: 'pointer' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      border: '3px solid #0A0A0A',
                      background: panelFillColor,
                      boxShadow: '3px 3px 0px #0A0A0A',
                      overflow: 'hidden',
                    }}
                  />
                  <input
                    type="color"
                    value={panelFillColor}
                    onChange={(e) => setPanelFillColor(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Canvas Background Color */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--nb-font)', fontSize: 12, fontWeight: 700, color: '#0A0A0A' }}>Canvas Background</span>
                <label style={{ position: 'relative', cursor: 'pointer' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      border: '3px solid #0A0A0A',
                      background: backgroundColor,
                      boxShadow: '3px 3px 0px #0A0A0A',
                      overflow: 'hidden',
                    }}
                  />
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Reset colors button */}
              <button
                onClick={() => {
                  setBorderColor('#111111')
                  setPanelFillColor('#ffffff')
                  setBackgroundColor('#faf8ef')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontFamily: 'var(--nb-font)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: '2px solid #0A0A0A',
                  background: '#FFFFFF',
                  color: '#0A0A0A',
                  width: 'fit-content',
                  boxShadow: '2px 2px 0px #0A0A0A',
                }}
              >
                <RefreshCw size={12} /> Reset Colors
              </button>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 8,
                background: savedSuccess ? '#06D6A0' : '#FFE66D',
                border: '3px solid #0A0A0A',
                padding: '12px 0',
                fontSize: 14,
                fontFamily: 'var(--nb-font)',
                fontWeight: 900,
                color: '#0A0A0A',
                cursor: 'pointer',
                boxShadow: savedSuccess ? 'none' : '5px 5px 0px #0A0A0A',
                transform: savedSuccess ? 'translate(5px, 5px)' : 'translate(0,0)',
                transition: 'all 0.08s ease',
                letterSpacing: '-0.2px',
              }}
              onMouseEnter={(e) => {
                if (!savedSuccess) {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-2px,-2px)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '7px 7px 0px #0A0A0A'
                }
              }}
              onMouseLeave={(e) => {
                if (!savedSuccess) {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translate(0,0)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '5px 5px 0px #0A0A0A'
                }
              }}
            >
              {savedSuccess ? <Check size={18} strokeWidth={3} /> : <Save size={18} strokeWidth={3} />}
              <span>{savedSuccess ? '✓ SAVED!' : 'SAVE LAYOUT'}</span>
            </button>
          </div>

          {/* ── Right: Big Live Canvas ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: '#F0EBD8',
              borderRadius: 12,
              border: '3px solid #0A0A0A',
              padding: 16,
              minWidth: 0,
              boxShadow: '4px 4px 0px #0A0A0A',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--nb-font)',
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#0A0A0A',
                textAlign: 'center',
              }}
            >
              ⚡ Live Canvas Preview
            </div>

            {/* Canvas container */}
            <div
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 480,
                borderRadius: 8,
                overflow: 'hidden',
                background: backgroundColor,
                border: `${borderThickness + 2}px solid ${borderColor}`,
                padding: panelGap,
                boxSizing: 'border-box',
                boxShadow: `4px 4px 0px #0A0A0A`,
              }}
            >
              {/* Halftone overlay on canvas background */}
              <HalftonePattern width={600} height={600} color={borderColor} />

              {/* Dynamic panel grid */}
              <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex' }}>
                {renderCanvas()}
              </div>
            </div>

            <div style={{ fontFamily: 'var(--nb-font)', fontSize: 11, color: '#0A0A0A', textAlign: 'center', opacity: 0.5, fontWeight: 600 }}>
              Layouts are stored in your browser library.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
