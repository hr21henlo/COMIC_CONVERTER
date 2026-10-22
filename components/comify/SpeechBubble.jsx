import React from 'react'

export function SpeechBubble({
  text,
  className = '',
  style = {}
}) {
  if (!text) return null
  const cleanText = text.replace(/^["']|["']$/g, '').trim()

  return (
    <div
      className={`relative inline-block bg-white border-[2.5px] border-black rounded-2xl px-3.5 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] z-20 max-w-[75%] sm:max-w-[65%] ${className}`}
      style={style}
    >
      {/* Speech Text */}
      <p
        className="text-xs sm:text-[13.5px] font-bold text-black m-0 select-none leading-snug"
        style={{ fontFamily: "'Comic Neue', 'Space Grotesk', system-ui, sans-serif", letterSpacing: '0.01em' }}
      >
        "{cleanText}"
      </p>

      {/* Clean White Triangle Pointer Tail with Black Outline */}
      <div
        className="absolute -bottom-[10px] left-5 w-0 h-0"
        style={{
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '10px solid #000000',
        }}
      />
      <div
        className="absolute -bottom-[7px] left-[21px] w-0 h-0"
        style={{
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: '8px solid #FFFFFF',
        }}
      />
    </div>
  )
}

export default SpeechBubble
