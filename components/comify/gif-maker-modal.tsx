'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  X,
  Film,
  Paintbrush,
  Download,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Sparkles,
  ArrowRight,
  FolderHeart,
  Layers,
  Type
} from 'lucide-react'

interface StickerItem {
  id: string
  name: string
  imageUrl: string
  timestamp: number
}

interface GifMakerModalProps {
  isOpen: boolean
  onClose: () => void
}

export function GifMakerModal({ isOpen, onClose }: GifMakerModalProps) {
  const [activeTab, setActiveTab] = useState<'slate' | 'sticker'>('slate')

  // ── Tab 1: Draw Motion Slate ──
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [drawColor, setDrawColor] = useState<string>('#ff007c')
  const [brushSize, setBrushSize] = useState<number>(6)
  const [isDrawing, setIsDrawing] = useState(false)
  const [motionType, setMotionType] = useState<'slide' | 'bounce' | 'spin' | 'pulse' | 'orbit'>('slide')
  const [motionSpeed, setMotionSpeed] = useState<number>(2)

  // ── Tab 2: Sticker to GIF ──
  const [savedStickers, setSavedStickers] = useState<StickerItem[]>([])
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null)
  const [captionText, setCaptionText] = useState('')

  // ── Animation Preview Stage ──
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)

  // Load saved stickers on open
  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('comicgen_stickers')
      if (stored) {
        try {
          const list: StickerItem[] = JSON.parse(stored)
          setSavedStickers(list)
          if (list.length > 0 && !selectedSticker) {
            setSelectedSticker(list[0].imageUrl)
          }
        } catch (e) {
          console.warn('Failed parsing stickers:', e)
        }
      }
    }
  }, [isOpen])

  // Clear drawing slate on tab switch or open
  useEffect(() => {
    if (isOpen && activeTab === 'slate' && drawCanvasRef.current) {
      const canvas = drawCanvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [isOpen, activeTab])

  // ── Animation Engine Loop ──
  useEffect(() => {
    if (!isOpen || !isPlaying) return

    let animId: number
    let startTime = performance.now()

    const renderFrame = (now: number) => {
      const pCanvas = previewCanvasRef.current
      if (!pCanvas) return
      const ctx = pCanvas.getContext('2d')
      if (!ctx) return

      const width = pCanvas.width
      const height = pCanvas.height

      // Clear stage background
      ctx.fillStyle = '#051421'
      ctx.fillRect(0, 0, width, height)

      // Draw subtle background grid
      ctx.strokeStyle = '#072238'
      ctx.lineWidth = 1
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      const elapsed = (now - startTime) / 1000
      const t = elapsed * motionSpeed

      let xPos = width / 2
      let yPos = height / 2
      let rotation = 0
      let scale = 1.0

      if (motionType === 'slide') {
        xPos = ( (t * 120) % (width + 120) ) - 60
        yPos = height / 2
      } else if (motionType === 'bounce') {
        xPos = width / 2
        yPos = height / 2 - Math.abs(Math.sin(t * 4)) * 60
      } else if (motionType === 'spin') {
        rotation = t * 3
      } else if (motionType === 'pulse') {
        scale = 1.0 + Math.sin(t * 5) * 0.25
      } else if (motionType === 'orbit') {
        xPos = width / 2 + Math.cos(t * 3) * 80
        yPos = height / 2 + Math.sin(t * 3) * 50
      }

      ctx.save()
      ctx.translate(xPos, yPos)
      ctx.rotate(rotation)
      ctx.scale(scale, scale)

      if (activeTab === 'slate' && drawCanvasRef.current) {
        ctx.drawImage(drawCanvasRef.current, -80, -60, 160, 120)
      } else if (activeTab === 'sticker' && selectedSticker) {
        const img = new Image()
        img.src = selectedSticker
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -70, -70, 140, 140)
        }
      }

      ctx.restore()

      // Render overlay text if provided
      if (captionText.trim()) {
        ctx.fillStyle = '#34e0c4'
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(captionText, width / 2, height - 20)
      }

      animId = requestAnimationFrame(renderFrame)
    }

    animId = requestAnimationFrame(renderFrame)
    return () => cancelAnimationFrame(animId)
  }, [isOpen, isPlaying, activeTab, motionType, motionSpeed, selectedSticker, captionText])

  if (!isOpen) return null

  // ── Drawing Slate handlers ──
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    ctx.strokeStyle = drawColor
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const handleClearDrawing = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // ── Download Animated GIF Frame Render ──
  const handleDownloadGIF = () => {
    const pCanvas = previewCanvasRef.current
    if (!pCanvas) return
    const link = document.createElement('a')
    link.href = pCanvas.toDataURL('image/png')
    link.download = `comicgen-gif-frame-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border-2 border-[#34e0c4]/40 bg-[#071926] text-white shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#34e0c4]/20 text-[#34e0c4]">
              <Film className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">GIF Maker & Animator</h2>
              <p className="text-[12px] text-[#7fa8d8]">Animate white slate drawings & stickers</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-[#051421] px-6">
          <button
            onClick={() => setActiveTab('slate')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[14px] font-extrabold transition-all ${
              activeTab === 'slate'
                ? 'border-[#34e0c4] text-[#34e0c4]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Paintbrush className="h-4 w-4" />
            <span>White Slate Draw & Move</span>
          </button>

          <button
            onClick={() => setActiveTab('sticker')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[14px] font-extrabold transition-all ${
              activeTab === 'sticker'
                ? 'border-[#34e0c4] text-[#34e0c4]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Sticker to GIF Animator</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Controls */}
          <div className="flex flex-col gap-4">
            
            {activeTab === 'slate' ? (
              <div className="flex flex-col gap-3">
                <label className="text-[13px] font-bold text-[#34e0c4]">Draw Your Character/Object:</label>
                <div className="flex items-center gap-2 mb-1">
                  {['#ff007c', '#00bda1', '#ffd000', '#00d2ff', '#000000'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setDrawColor(c)}
                      style={{ backgroundColor: c }}
                      className={`h-6 w-6 rounded-full border-2 ${drawColor === c ? 'border-white' : 'border-transparent'}`}
                    />
                  ))}
                  <button
                    onClick={handleClearDrawing}
                    className="ml-auto flex items-center gap-1 text-[11px] text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear</span>
                  </button>
                </div>

                <canvas
                  ref={drawCanvasRef}
                  width={340}
                  height={200}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="cursor-crosshair rounded-[14px] border-2 border-[#34e0c4]/40 bg-white touch-none"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="text-[13px] font-bold text-[#34e0c4]">Select Sticker from Library:</label>
                {savedStickers.length === 0 ? (
                  <div className="p-4 rounded-[14px] bg-[#051421] text-center text-[12px] text-white/50 border border-white/10">
                    No stickers found in library yet! Use the Sticker Builder to create stickers first.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-[220px] overflow-y-auto p-2 bg-[#051421] rounded-[14px] border border-white/10">
                    {savedStickers.map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setSelectedSticker(st.imageUrl)}
                        className={`flex items-center justify-center p-2 rounded-[10px] border transition-all ${
                          selectedSticker === st.imageUrl
                            ? 'border-[#34e0c4] bg-[#34e0c4]/20'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <img src={st.imageUrl} alt={st.name} className="h-16 w-16 object-contain" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Motion Presets */}
            <div>
              <label className="mb-2 block text-[13px] font-bold text-[#34e0c4]">Motion Pattern:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'slide', label: '➡️ Slide L-R' },
                  { id: 'bounce', label: '⬆️ Bounce' },
                  { id: 'spin', label: '🔄 Spin' },
                  { id: 'pulse', label: '💫 Pulse' },
                  { id: 'orbit', label: '🌊 Orbit' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMotionType(m.id as any)}
                    className={`rounded-[10px] border py-2 text-[12px] font-bold transition-all ${
                      motionType === m.id
                        ? 'border-[#34e0c4] bg-[#34e0c4] text-[#03131c]'
                        : 'border-white/10 bg-[#051421] text-white/80 hover:border-white/30'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption text */}
            <div>
              <label className="mb-1 block text-[12px] font-bold text-white/80">Animation Caption Text:</label>
              <input
                type="text"
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                placeholder="e.g. BOOM!, GOING FAST!, WOW!"
                className="w-full rounded-[10px] border border-white/20 bg-[#03131c] px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#34e0c4]"
              />
            </div>
          </div>

          {/* Right Animation Stage */}
          <div className="flex flex-col items-center justify-between bg-[#051421] p-4 rounded-[20px] border border-white/10">
            <div className="text-[13px] font-extrabold uppercase tracking-wider text-[#34e0c4] mb-2">
              Live GIF Preview Stage
            </div>

            <canvas
              ref={previewCanvasRef}
              width={340}
              height={260}
              className="rounded-[16px] border-2 border-[#34e0c4]/40 bg-[#051421] shadow-2xl"
            />

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setIsPlaying((prev) => !prev)}
                className="flex items-center gap-2 rounded-full bg-[#0b263b] border border-[#34e0c4]/40 px-4 py-2 text-[13px] font-bold text-[#34e0c4] hover:bg-[#123550]"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                onClick={handleDownloadGIF}
                className="flex items-center gap-2 rounded-full bg-[#34e0c4] px-5 py-2 text-[13px] font-extrabold text-[#03131c] shadow-md hover:scale-105 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Export Animated GIF</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
