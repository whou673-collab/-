import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'
import { Agent, fetch as outboundFetch } from 'undici'
import { AppError } from './errors'
import { readLimitedBody } from './validation'

export function isPublicAddress(address: string) {
  try { return ipaddr.process(address).range() === 'unicast' }
  catch { return false }
}

export function publicUrl(value: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new AppError('请填写有效的 HTTPS 地址。') }
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || url.hash) {
    throw new AppError('仅支持标准 443 端口的 HTTPS 地址，不能包含用户名、密码或片段。')
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new AppError('不能连接本机、内网或保留地址。')
  } else if (!hostname.includes('.') || /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(hostname)) {
    throw new AppError('请使用公网 API 域名，不能连接内部地址。')
  }
  return url
}

export function normalizeApiBase(value: string) {
  const url = publicUrl(value.trim())
  if (url.search) throw new AppError('API 基础地址不能包含查询参数，请把密钥填入 API Key。')
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/(?:models|images\/(?:generations|edits))$/, '') || '/v1'
  return url.toString().replace(/\/$/, '')
}

const dispatcher = new Agent({
  connect: {
    timeout: 15_000,
    // Validate the DNS results used by the socket itself, not an earlier lookup.
    lookup(hostname, options, callback) {
      lookup(hostname, { all: true, verbatim: true }).then((addresses) => {
        if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
          callback(new Error('NonPublicDestination'), '', 4)
          return
        }
        if (options.all) callback(null, addresses)
        else {
          const selected = addresses.find((entry) => entry.family === options.family) || addresses.find((entry) => entry.family === 4) || addresses[0]
          callback(null, selected.address, selected.family)
        }
      }).catch(() => callback(new Error('DestinationLookupFailed'), '', 4))
    },
  },
  headersTimeout: 250_000,
  bodyTimeout: 250_000,
  connections: 12,
})

export async function safeFetch(value: string, init: RequestInit = {}, options: { maxBytes: number; timeoutMs?: number; maxRedirects?: number }) {
  let url = publicUrl(value)
  const deadline = AbortSignal.timeout(options.timeoutMs ?? 20_000)
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline
  const maxRedirects = options.maxRedirects ?? 0
  try {
    for (let redirects = 0; ; redirects++) {
      const response = await outboundFetch(url, { ...init, redirect: 'manual', dispatcher, signal } as Parameters<typeof outboundFetch>[1])
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location || redirects >= maxRedirects || new Headers(init.headers).has('authorization')) {
          throw new AppError('API 返回了重定向。请填写最终的 HTTPS API 地址。', 502)
        }
        url = publicUrl(new URL(location, url).toString())
        continue
      }
      const bytes = await readLimitedBody(new Response(response.body as ReadableStream<Uint8Array> | null, { headers: { 'content-length': response.headers.get('content-length') || '' } }), options.maxBytes)
      return new Response([204, 205, 304].includes(response.status) ? null : bytes, {
        status: response.status,
        headers: { 'Content-Type': response.headers.get('content-type') || 'application/octet-stream' },
      })
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    if (signal.aborted) throw new AppError('API 请求超时。若已经提交生图，请先查看服务商调用记录，避免重复计费。', 504)
    throw new AppError('无法安全连接 API，请确认公网地址、HTTPS 证书与服务状态。', 502)
  }
}
