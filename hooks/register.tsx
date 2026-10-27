import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface, SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { Quota } from '../types'

const limits = atom({ plugin: 'cc-usage', key: 'limits' } as const, [] as Quota[])
const contextPercent = atom({ plugin: 'cc-usage', key: 'contextPercent' } as const, null as number | null)

const GREEN = '#22c55e'
const BLUE = '#3b82f6'
const ORANGE = '#f97316'
const RAINBOW = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']

// 25% 以下绿色，25%-55% 蓝色，55%-75% 橙色，75% 以上七彩渐变
const colorFor = (pct: number) => (pct < 25 ? GREEN : pct < 55 ? BLUE : pct < 75 ? ORANGE : null)

const duration = (iso: string | undefined, now: number) => {
  if (!iso) return null
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return null
  const mins = Math.ceil(ms / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m}ms` : `${m}ms`
}

const save = async ($: EngineInterface, context: SessionContextUsage, rateLimits: SessionRateLimit[]) => {
  await update($, limits, () => rateLimits.map(r => ({ ...r })))
  await update($, contextPercent, () => context.percent ?? null)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { context, rateLimits } = await $.session.usage()
    await save($, context, rateLimits)
    return result
  })

  on('session.measure', async ($, e, next) => {
    await save($, e.context, e.rateLimits)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const quotas = await read($, limits)
    const ctx = await read($, contextPercent)

    const colored = (text: string, pct: number | null, key: string) => {
      if (pct === null) return <Text key={key} dimColor>{text}</Text>
      const color = colorFor(pct)
      if (color) return <Text key={key} color={color}>{text}</Text>
      return (
        <Text key={key}>
          {[...text].map((ch, i) => (
            <Text key={String(i)} color={RAINBOW[i % RAINBOW.length]}>{ch}</Text>
          ))}
        </Text>
      )
    }

    const quotaText = (label: string, kind: string, showPercent: boolean, pad: string) => {
      const q = quotas.find(l => l.kind === kind)
      if (!q) return colored(`${label}: --`, null, kind)
      const left = duration(q.resetsAt, now)
      const pct = showPercent ? ` ${q.percentUsed}%` : ''
      const paren = left ? ` (${pad}${left}${pad})` : ''
      return colored(`${label}:${pct}${paren}`, q.percentUsed, kind)
    }

    return (
      <Box flexDirection="row" justifyContent="flex-end" width="100%" gap={5}>
        {colored(ctx === null ? 'context: --' : `context: ${ctx}%`, ctx, 'context')}
        {quotaText('5hs', 'five_hour', true, ' ')}
        {quotaText('weekly', 'seven_day', false, '')}
      </Box>
    )
  })
}
