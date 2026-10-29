export const GROUP_BY_VALUES = ['finding', 'rule', 'rule+url'] as const

export type GroupBy = (typeof GROUP_BY_VALUES)[number]

export function isGroupBy(value: string): value is GroupBy {
  return (GROUP_BY_VALUES as readonly string[]).includes(value)
}
