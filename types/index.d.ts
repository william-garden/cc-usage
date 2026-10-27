export type Quota = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'cc-usage': { limits: Quota[]; contextPercent: number | null }
  }
}
