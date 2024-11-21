/// <reference lib="webworker" />
// @ts-ignore
import { Readable } from 'readable-stream'
import SmpReader from 'styled-map-package/reader'
import { Reader, fromReader } from 'yauzl-promise'

addEventListener(
  'message',
  (event) => {
    if (event.data.type !== 'file')
      throw new Error('Worker must be initialized with a file')
    const file: File = event.data.file

    const readerPromise = (async () => {
      const zip = await fromReader(new FileReader(file), file.size)
      return new SmpReader(zip)
    })()

    addEventListener('message', async (event) => {
      if (event.data.type === 'file')
        throw new Error('Worker already initialized')
      const reader = await readerPromise
      if (typeof event.data.url !== 'string') throw new Error('Invalid Message')

      const url = event.data.url.replace(/^smp:\/\/maps.v1\//, '')
      try {
        const { stream, contentEncoding, contentLength } =
          await reader.getResource(url)
        let buffer = new ArrayBuffer(contentLength)
        const uint8 = new Uint8Array(buffer)
        let offset = 0
        for await (const chunk of stream) {
          uint8.set(chunk, offset)
          offset += chunk.length
        }
        if (contentEncoding === 'gzip') {
          buffer = await gunzip(buffer)
        }
        postMessage({ id: event.data.id, data: buffer }, [buffer])
      } catch (error: any) {
        postMessage({ id: event.data.id, error: error.message })
      }
    })
  },
  { once: true },
)

const CACHE_CHUNK_SIZE = 0xffff

class FileReader extends Reader {
  #file
  #cached: { start: number; buf: ArrayBuffer } | null = null

  constructor(file: File) {
    super()
    this.#file = file
  }

  _createReadStream(start: number, length: number): Readable {
    const blob = this.#file.slice(start, start + length)
    return fromWebReadableStream(blob.stream())
  }

  async _read(start: number, length: number): Promise<Buffer> {
    if (
      this.#cached &&
      this.#cached.start <= start &&
      start + length <= this.#cached.start + this.#cached.buf.byteLength
    ) {
      const offset = start - this.#cached.start
      return Buffer.from(this.#cached.buf, offset, length)
    }
    const blob = this.#file.slice(
      start,
      start + Math.max(CACHE_CHUNK_SIZE, length),
    )
    const buf = await blob.arrayBuffer()
    this.#cached = { start, buf }
    return Buffer.from(buf, 0, length)
  }
}

export function fromWebReadableStream(
  readableStream: ReadableStream,
  options: {
    highWaterMark?: number
    encoding?: string
    objectMode?: boolean
    signal?: AbortSignal
  } = {},
): Readable {
  const { highWaterMark, encoding, objectMode = false, signal } = options

  if (encoding !== undefined && !Buffer.isEncoding(encoding))
    throw new Error('Invalid encoding')

  const reader = readableStream.getReader()
  let closed = false

  const readable = new Readable({
    objectMode,
    highWaterMark,
    encoding,
    // @ts-ignore
    signal,

    read() {
      reader.read().then(
        (chunk) => {
          if (chunk.done) {
            // Value should always be undefined here.
            readable.push(null)
          } else {
            readable.push(chunk.value)
          }
        },
        (error) => readable.destroy(error),
      )
    },

    destroy(error, callback) {
      function done() {
        try {
          callback(error)
        } catch (error) {
          // In a next tick because this is happening within
          // a promise context, and if there are any errors
          // thrown we don't want those to cause an unhandled
          // rejection. Let's just escape the promise and
          // handle it separately.
          process.nextTick(() => {
            throw error
          })
        }
      }

      if (!closed) {
        reader.cancel(error).then(done, done)
        return
      }
      done()
    },
  })

  reader.closed.then(
    () => {
      closed = true
    },
    (error) => {
      closed = true
      readable.destroy(error)
    },
  )

  return readable
}

async function gunzip(inputBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  // Create a DecompressionStream instance for gzip
  const decompressionStream = new DecompressionStream('gzip')

  // Convert the input ArrayBuffer to a ReadableStream
  const inputStream = new Response(inputBuffer)
    .body as ReadableStream<Uint8Array>

  // Pipe the input stream through the decompression stream
  const decompressedStream = inputStream.pipeThrough(decompressionStream)

  // Read the decompressed stream into a new ArrayBuffer
  const decompressedArrayBuffer = await new Response(
    decompressedStream,
  ).arrayBuffer()

  return decompressedArrayBuffer
}
