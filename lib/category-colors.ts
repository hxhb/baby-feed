export const CATEGORY_COLORS = {
  pink:   { border: 'border-pink-500', bg: 'bg-pink-50', text: 'text-pink-700', icon: 'text-pink-500' },
  blue:   { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
  orange: { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-500' },
  green:  { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
  red:    { border: 'border-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-500' },
  purple: { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-500' },
  teal:   { border: 'border-teal-500', bg: 'bg-teal-50', text: 'text-teal-700', icon: 'text-teal-500' },
  amber:  { border: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500' },
  indigo: { border: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-500' },
} as const

export type CategoryColor = keyof typeof CATEGORY_COLORS

export function getCategoryColorClasses(color: string, isSelected: boolean) {
  const c = CATEGORY_COLORS[color as CategoryColor] ?? CATEGORY_COLORS.green
  return isSelected ? c : { border: 'border-gray-200', bg: '', text: 'text-gray-600', icon: 'text-gray-400' }
}
