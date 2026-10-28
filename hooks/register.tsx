import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface, SessionContextUsage, SessionCost, SessionRateLimit } from 'claude-code'

import type { Quota, Tokens } from '../types'

const limits = atom({ plugin: 'cc-usage', key: 'limits' } as const, [] as Quota[])
const contextPercent = atom({ plugin: 'cc-usage', key: 'contextPercent' } as const, null as number | null)
const tokens = atom({ plugin: 'cc-usage', key: 'tokens' } as const, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as Tokens)
const costUsd = atom({ plugin: 'cc-usage', key: 'costUsd' } as const, null as number | null)

const GREEN = '#22c55e'
const BLUE = '#3b82f6'
const ORANGE = '#f97316'

// 色相 0..360、饱和度/亮度 0..1 转成 #rrggbb
const hsl = (h: number, s: number, l: number) => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// 一段文字从头到尾走完一遍红→紫的七彩，不重复；最后的蓝、紫两段亮度提高 10%
const rainbowAt = (i: number, n: number) => {
  const h = n > 1 ? (280 * i) / (n - 1) : 0
  const lift = Math.max(0, Math.min(1, (h - 180) / 40)) * 0.1
  return hsl(h, 0.85, 0.6 + lift)
}

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

// 1234 -> 1.2k, 1234567 -> 1.2M
const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n)

const save = async (
  $: EngineInterface,
  context: SessionContextUsage,
  rateLimits: SessionRateLimit[],
  cost: SessionCost | undefined,
) => {
  await update($, limits, () => rateLimits.map(r => ({ ...r })))
  await update($, contextPercent, () => context.percent ?? null)
  await update($, costUsd, () => cost?.usd ?? null)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { context, rateLimits, cost } = await $.session.usage()
    await save($, context, rateLimits, cost)
    return result
  })

  on('session.measure', async ($, e, next) => {
    await save($, e.context, e.rateLimits, e.cost)
    return next(e)
  })

  // 只显示主对话最近一轮的 token，不累加；子代理的轮次不覆盖它
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) return result

    const usage = result.usage ?? e.usage
    if (usage) {
      await update($, tokens, () => ({
        input: usage.input_tokens,
        output: usage.output_tokens,
        cacheRead: usage.cache_read_input_tokens,
        cacheWrite: usage.cache_creation_input_tokens,
      }))
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const quotas = await read($, limits)
    const ctx = await read($, contextPercent)
    const t = await read($, tokens)
    const cost = await read($, costUsd)

    const colored = (text: string, pct: number | null, key: string) => {
      if (pct === null) return <Text key={key} dimColor>{text}</Text>
      const color = colorFor(pct)
      if (color) return <Text key={key} color={color}>{text}</Text>
      return (
        <Text key={key}>
          {[...text].map((ch, i, all) => (
            <Text key={String(i)} color={rainbowAt(i, all.length)}>{ch}</Text>
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

    const stat = (label: string, value: string) => (
      <Text key={label}>
        <Text dimColor>{label}: </Text>
        <Text>{value}</Text>
      </Text>
    )

    return (
      <Box flexDirection="column" width="100%">
        <Box flexDirection="row" justifyContent="flex-end" width="100%" gap={2}>
          {colored(ctx === null ? 'context: --' : `context: ${ctx}%`, ctx, 'context')}
          {quotaText('5hs', 'five_hour', true, ' ')}
          {quotaText('weekly', 'seven_day', true, '')}
        </Box>
        <Box flexDirection="row" justifyContent="flex-end" width="100%" gap={2}>
          {stat('input', compact(t.input))}
          {stat('output', compact(t.output))}
          {stat('cache hit', compact(t.cacheRead))}
          {stat('cost', cost === null ? '--' : `$${cost.toFixed(2)}`)}
        </Box>
      </Box>
    )
  })
}
