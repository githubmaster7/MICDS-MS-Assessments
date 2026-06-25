'use client'

import { useRef, useEffect } from 'react'

export interface ColorDistribution {
  red: number
  yellow: number
  lightgreen: number
  brightgreen: number
}

interface ColorDonutProps {
  distribution: ColorDistribution
  size?: number
  strokeWidth?: number
  className?: string
}

const SEGMENTS = [
  { key: 'red' as const, label: 'Beginning', color: '#ef4444' },
  { key: 'yellow' as const, label: 'Developing', color: '#eab308' },
  { key: 'lightgreen' as const, label: 'Proficient', color: '#86efac' },
  { key: 'brightgreen' as const, label: 'Advanced', color: '#22c55e' },
]

export function ColorDonut({ distribution, size = 64, strokeWidth = 10, className }: ColorDonutProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const total =
    distribution.red + distribution.yellow + distribution.lightgreen + distribution.brightgreen

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const radius = (size - strokeWidth) / 2

    ctx.clearRect(0, 0, size, size)

    if (total === 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = strokeWidth
      ctx.stroke()
      return
    }

    let startAngle = -Math.PI / 2
    const gap = total > 1 ? 0.04 : 0

    for (const seg of SEGMENTS) {
      const count = distribution[seg.key]
      if (count === 0) continue
      const sweep = (count / total) * (Math.PI * 2) - gap
      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, startAngle + sweep)
      ctx.strokeStyle = seg.color
      ctx.lineWidth = strokeWidth
      ctx.lineCap = 'butt'
      ctx.stroke()
      startAngle += sweep + gap
    }
  }, [distribution, size, strokeWidth, total])

  const ariaLabel = SEGMENTS.filter((s) => distribution[s.key] > 0)
    .map((s) => `${s.label}: ${distribution[s.key]}`)
    .join(', ')

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={className}
      role="img"
      aria-label={total === 0 ? 'No scores yet' : ariaLabel}
    />
  )
}

export function ColorDonutLegend({ distribution }: { distribution: ColorDistribution }) {
  const total =
    distribution.red + distribution.yellow + distribution.lightgreen + distribution.brightgreen

  if (total === 0) return null

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {SEGMENTS.filter((s) => distribution[s.key] > 0).map((s) => {
        const pct = Math.round((distribution[s.key] / total) * 100)
        return (
          <span key={s.key} className="flex items-center gap-1 text-xs text-gray-500">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            {pct}%
          </span>
        )
      })}
    </div>
  )
}
