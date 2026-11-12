"use client"

import { Minus, Plus } from "lucide-react"

interface QuantitySelectorProps {
  quantity: number
  onQuantityChange: (quantity: number) => void
  min?: number
  max?: number
}

export function QuantitySelector({
  quantity,
  onQuantityChange,
  min = 1,
  max = 99,
}: QuantitySelectorProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-full bg-[#F0EEED] px-4 py-2 sm:px-5 sm:py-3 w-[120px] sm:w-[150px] shrink-0 select-none">
      <button
        type="button"
        onClick={() => onQuantityChange(Math.max(min, quantity - 1))}
        disabled={quantity <= min}
        aria-label="Decrease quantity"
        className="flex items-center justify-center text-black hover:opacity-70 disabled:opacity-30 active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-full p-1"
      >
        <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
      </button>

      <span className="text-sm sm:text-base font-semibold text-black tabular-nums">
        {quantity}
      </span>

      <button
        type="button"
        onClick={() => onQuantityChange(Math.min(max, quantity + 1))}
        disabled={quantity >= max}
        aria-label="Increase quantity"
        className="flex items-center justify-center text-black hover:opacity-70 disabled:opacity-30 active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-full p-1"
      >
        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
      </button>
    </div>
  )
}
