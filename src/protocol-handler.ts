import { type AddProtocolAction } from 'maplibre-gl'
import { pEvent } from 'p-event'

export default function createProtocolHandler(file: File): AddProtocolAction {
  let counter = 0
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  })

  worker.postMessage({ type: 'file', file })
  return async ({ url, type }) => {
    const id = ++counter

    worker.postMessage({ url, id })
    const event = await pEvent<'message', MessageEvent>(
      worker,
      'message',
      (e) => e.data.id === id,
    )
    if (event.data.error) {
      const cacheControl = 'max-age=600'
      switch (type) {
        case 'json':
          return { data: null, cacheControl }
        case 'string':
          return { data: '', cacheControl }
        case 'arrayBuffer':
        case 'image':
        default:
          return { data: new ArrayBuffer(0), cacheControl }
      }
    }
    const buf = event.data.data as ArrayBuffer
    let data: ArrayBuffer | string | {}
    switch (type) {
      case 'json':
        data = JSON.parse(new TextDecoder().decode(buf))
        break
      case 'string':
        data = new TextDecoder().decode(buf)
        break
      case 'arrayBuffer':
      case 'image':
      default:
        data = buf
    }

    return {
      data,
      cacheControl: 'max-age=300', // 5 mins
    }
  }
}
