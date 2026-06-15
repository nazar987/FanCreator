import type { FanCreatorApi } from '@shared/api'

declare global {
  interface Window {
    api: FanCreatorApi
  }
}

export {}
