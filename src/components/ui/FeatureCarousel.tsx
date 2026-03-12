'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CarouselSlide {
  src: string
  alt: string
  caption: string
}

interface FeatureCarouselProps {
  slides: CarouselSlide[]
  autoAdvanceMs?: number
}

export function FeatureCarousel({ slides, autoAdvanceMs = 4000 }: FeatureCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length)
  }, [slides.length])

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + slides.length) % slides.length)
  }, [slides.length])

  useEffect(() => {
    if (paused || slides.length <= 1) return
    const timer = setInterval(next, autoAdvanceMs)
    return () => clearInterval(timer)
  }, [paused, next, autoAdvanceMs, slides.length])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) {
      if (diff > 0) next()
      else prev()
    }
  }

  if (slides.length === 0) return null

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Image container with phone frame look */}
      <div className="relative mx-auto aspect-9/16 w-full max-w-[280px] overflow-hidden rounded-2xl border-[3px] border-border bg-background shadow-[4px_4px_0px_0px_hsl(var(--border))]">
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className={`absolute inset-0 transition-opacity duration-500 ${
              i === current ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              className="object-cover object-top"
              sizes="280px"
              priority={i === 0}
            />
          </div>
        ))}

        {/* Arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2 rounded-full border-2 border-border bg-card/90 p-1 shadow-xs backdrop-blur-xs transition-colors hover:bg-card"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-full border-2 border-border bg-card/90 p-1 shadow-xs backdrop-blur-xs transition-colors hover:bg-card"
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Caption */}
      <p className="mt-3 text-center text-xs text-muted-foreground">{slides[current].caption}</p>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 w-2 rounded-full border border-border transition-colors ${
                i === current ? 'bg-primary' : 'bg-muted'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
