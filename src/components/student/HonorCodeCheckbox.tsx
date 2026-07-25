'use client'

import { cn } from '@/lib/utils'

const HONOR_CODE_TEXT = `I affirm that the work I am submitting is entirely my own. I have not used AI tools, Google, Canvas resources, or any outside help. I used only my own brain and what I have learned in this class.`

interface HonorCodeCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function HonorCodeCheckbox({ checked, onChange, className }: HonorCodeCheckboxProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 p-4 transition-colors',
        checked ? 'border-emerald-300 bg-emerald-50' : 'border-amber-200 bg-amber-50',
        className,
      )}
    >
      <p className="text-xs uppercase tracking-wider font-semibold text-amber-700 mb-2">
        Honor Code — Required
      </p>
      <p className="text-sm text-gray-700 leading-relaxed mb-4 italic">
        &ldquo;{HONOR_CODE_TEXT}&rdquo;
      </p>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <span className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
            aria-label="I acknowledge and affirm the Honor Code above"
          />
          <span
            className={cn(
              'block w-5 h-5 rounded-md border-2 transition-colors',
              checked
                ? 'bg-emerald-500 border-emerald-500'
                : 'bg-white border-gray-300 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-1',
            )}
            aria-hidden="true"
          >
            {checked && (
              <svg
                viewBox="0 0 12 12"
                fill="none"
                className="w-full h-full p-0.5"
                aria-hidden="true"
              >
                <path
                  d="M2 6l3 3 5-5"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        </span>
        <span className="text-sm font-semibold text-gray-700">
          I acknowledge and affirm the Honor Code above
        </span>
      </label>
    </div>
  )
}
