/**
 * @param {AsyncIterable|ReadableStream|Readable} stream
 * @returns {Promise<string>}
 */
export async function text(stream) {
  const dec = new TextDecoder()
  let str = ''
  for await (const chunk of stream) {
    if (typeof chunk === 'string') str += chunk
    else str += dec.decode(chunk, { stream: true })
  }
  // Flush the streaming TextDecoder so that any pending
  // incomplete multibyte characters are handled.
  str += dec.decode(undefined, { stream: false })
  return str
}

/**
 * @param {AsyncIterable|ReadableStream|Readable} stream
 * @returns {Promise<any>}
 */
export async function json(stream) {
  const str = await text(stream)
  return JSON.parse(str)
}
