'use client'

interface PasswordStrengthProps {
  password: string
}

interface StrengthResult {
  score: number // 0-4
  label: string
  emoji: string
  color: string
  bgColor: string
}

function calculateStrength(password: string): StrengthResult {
  if (!password) {
    return { score: 0, label: '', emoji: '', color: '', bgColor: 'bg-muted' }
  }

  let score = 0

  // Length checks
  if (password.length >= 8) score++
  if (password.length >= 10) score++
  if (password.length >= 14) score++

  // Character variety checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  // Cap at 4
  score = Math.min(score, 4)

  const strengthMap: Record<number, Omit<StrengthResult, 'score'>> = {
    0: { label: '', emoji: '', color: '', bgColor: 'bg-muted' },
    1: { label: 'Weak', emoji: '😰', color: 'text-destructive', bgColor: 'bg-destructive' },
    2: { label: 'Fair', emoji: '😐', color: 'text-sticker-orange', bgColor: 'bg-sticker-orange' },
    3: { label: 'Good', emoji: '😊', color: 'text-sticker-yellow', bgColor: 'bg-sticker-yellow' },
    4: { label: 'Strong', emoji: '💪', color: 'text-sticker-green', bgColor: 'bg-sticker-green' },
  }

  return { score, ...strengthMap[score] }
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = calculateStrength(password)

  if (!password) {
    return null
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bars */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-2 flex-1 rounded-full transition-colors border border-border ${
              level <= strength.score ? strength.bgColor : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Strength label */}
      {strength.label && (
        <p className={`text-xs font-bold ${strength.color}`}>
          {strength.emoji} {strength.label}
        </p>
      )}

      {/* Helpful tips for weak passwords */}
      {strength.score > 0 && strength.score < 3 && (
        <p className="text-xs text-muted-foreground">
          Try adding {strength.score < 2 ? 'more characters, ' : ''}
          {!/[A-Z]/.test(password) ? 'uppercase letters, ' : ''}
          {!/\d/.test(password) ? 'numbers, ' : ''}
          {!/[^a-zA-Z0-9]/.test(password) ? 'special characters' : ''}
        </p>
      )}
    </div>
  )
}
