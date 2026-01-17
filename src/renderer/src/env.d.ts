/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// ClipMorph preload API types
interface AppStatusResponse {
  ok: boolean
  requestId: string
  data?: { status: 'idle' | 'listening' | 'processing' | 'error' }
  error?: { code: string; message: string; details?: unknown }
}

interface ClipMorphAPI {
  getAppStatus: () => Promise<AppStatusResponse>
  onEvent: (callback: (event: { type: string; jobId?: string; payload?: unknown }) => void) => () => void
}

interface Window {
  clipmorph: ClipMorphAPI
}
