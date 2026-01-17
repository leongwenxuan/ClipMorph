import { ClipMorphAPI } from './index'

declare global {
  interface Window {
    clipmorph: ClipMorphAPI
  }
}

export { ClipMorphAPI }
