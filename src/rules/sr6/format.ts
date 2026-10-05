import type { Initiative } from './derived'

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function formatInitiative({ score, dice }: Initiative) {
  return `${score} + ${dice}D6`
}

export function armorHint(armor: number) {
  return armor > 0 ? `incl. armor ${armor}` : 'no armor equipped'
}

/** A dice pool after wound modifiers; never below zero. */
export function formatPool(pool: number, wounds: number) {
  return Math.max(0, pool + wounds)
}
