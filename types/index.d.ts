export type Quota = { kind: string; percentUsed: number; resetsAt?: string }

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

declare module 'claude-code' {
  interface PluginState {
    'cc-usage': {
      limits: Quota[]
      contextPercent: number | null
      tokens: Tokens
      costUsd: number | null
    }
  }
}
