import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { isPublicAddress, normalizeApiBase, publicUrl, safeFetch } from '../lib/server/outbound'
import { decryptApiKey, encryptApiKey, keyHint } from '../lib/server/encryption'
import { mergeModels, modelLooksLikeImage, providerStatusError } from '../lib/server/models'
import { generationSchema, readJson, readLimitedBody, uploadSchema } from '../lib/server/validation'
import { normalizeImageResponse, validateImageBase64 } from '../lib/server/provider'
import { prepareImage, safeImageName } from '../lib/server/images'
import { AppError } from '../lib/server/errors'
import { applicationOrigins, assertSameOrigin } from '../lib/server/origin'

const blockedAddresses = ['127.0.0.1', '0.0.0.0', '10.0.0.8', '172.16.1.1', '192.168.1.2', '169.254.169.254', '100.64.0.1', '192.0.2.1', '224.0.0.1', '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1']
for (const address of blockedAddresses) test(`拒绝非公网地址 ${address}`, () => assert.equal(isPublicAddress(address), false))

test('允许有效公网 IP', () => {
  assert.equal(isPublicAddress('1.1.1.1'), true)
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true)
})

test('规范化基础地址并保留服务商路径', () => {
  assert.equal(normalizeApiBase('https://api.example.com'), 'https://api.example.com/v1')
  assert.equal(normalizeApiBase('https://api.example.com/proxy/v1/images/generations/'), 'https://api.example.com/proxy/v1')
  assert.equal(normalizeApiBase('https://api.example.com/v1/models'), 'https://api.example.com/v1')
})

test('拦截 URL 凭证、私网、非 HTTPS 与混淆地址', () => {
  for (const url of ['http://api.example.com/v1', 'https://a:b@api.example.com/v1', 'https://localhost', 'https://metadata.google.internal', 'https://127.1', 'https://2130706433', 'https://[::ffff:127.0.0.1]', 'https://api.example.com:8443/v1', 'https://api.example.com/v1?key=secret']) {
    assert.throws(() => normalizeApiBase(url), AppError)
  }
  assert.equal(publicUrl('https://cdn.example.com/image.png?signature=abc').protocol, 'https:')
})

test('出站请求在访问网络前拦截私网', async () => {
  await assert.rejects(safeFetch('https://169.254.169.254/latest/meta-data', {}, { maxBytes: 100 }), AppError)
})

test('模型发现标记只是启发式且手动项不冒充发现项', () => {
  assert.equal(modelLooksLikeImage('some-image-model'), true)
  assert.equal(modelLooksLikeImage('chat-only-model'), false)
  const models = mergeModels([{ id: 'image-model', source: 'discovered', imageLikely: true }], ['image-model', 'manual-model'])
  assert.equal(models.length, 2)
  assert.equal(models.find((model) => model.id === 'manual-model')?.source, 'manual')
  assert.equal(models.find((model) => model.id === 'image-model')?.source, 'discovered')
})

test('API 密钥加密绑定账户和连接，篡改后不可解密', () => {
  const previous = process.env.API_KEY_ENCRYPTION_SECRET
  process.env.API_KEY_ENCRYPTION_SECRET = 'test-only-encryption-secret-never-used-in-production'
  try {
    const encrypted = encryptApiKey('test-provider-key', 'user-a', 'connection-a')
    assert.equal(encrypted.includes('test-provider-key'), false)
    assert.equal(decryptApiKey(encrypted, 'user-a', 'connection-a'), 'test-provider-key')
    assert.throws(() => decryptApiKey(encrypted, 'user-b', 'connection-a'), AppError)
    assert.throws(() => decryptApiKey(encrypted, 'user-a', 'connection-b'), AppError)
    const parts = encrypted.split('.')
    parts[3] = Buffer.from('tampered').toString('base64url')
    assert.throws(() => decryptApiKey(parts.join('.'), 'user-a', 'connection-a'), AppError)
    assert.notEqual(encrypted, encryptApiKey('test-provider-key', 'user-a', 'connection-a'))
    assert.equal(keyHint('short'), '••••')
  } finally {
    if (previous === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET
    else process.env.API_KEY_ENCRYPTION_SECRET = previous
  }
})

test('缺失加密配置时拒绝保存，不降级为明文', () => {
  const previous = process.env.API_KEY_ENCRYPTION_SECRET
  delete process.env.API_KEY_ENCRYPTION_SECRET
  try { assert.throws(() => encryptApiKey('test', 'a', 'b'), AppError) }
  finally { if (previous !== undefined) process.env.API_KEY_ENCRYPTION_SECRET = previous }
})

test('参数验证限制数量并拒绝重复参考图', () => {
  const input = { connectionId: randomUUID(), model: 'test-model', prompt: '一片海', size: '1024x1024', count: 1, requestId: randomUUID() }
  assert.equal(generationSchema.parse(input).count, 1)
  for (const count of [0, -1, 1.5, 11]) assert.equal(generationSchema.safeParse({ ...input, count }).success, false)
  assert.equal(generationSchema.safeParse({ ...input, count: 10 }).success, true)
  const id = randomUUID()
  assert.equal(generationSchema.safeParse({ ...input, referenceIds: [id, id] }).success, false)
  assert.equal(generationSchema.safeParse({ ...input, prompt: ' ' }).success, false)
})

test('参考图限制为 10 MB 和静态图像类型', () => {
  assert.equal(uploadSchema.safeParse({ name: 'test.png', mediaType: 'image/png', size: 10 * 1024 * 1024 }).success, true)
  assert.equal(uploadSchema.safeParse({ name: 'test.png', mediaType: 'image/png', size: 10 * 1024 * 1024 + 1 }).success, false)
  assert.equal(uploadSchema.safeParse({ name: 'test.svg', mediaType: 'image/svg+xml', size: 100 }).success, false)
})

test('空参考图在上传前被拒绝并返回清晰中文提示', () => {
  const result = uploadSchema.safeParse({ name: 'empty.png', mediaType: 'image/png', size: 0 })
  assert.equal(result.success, false)
  if (!result.success) assert.equal(result.error.issues[0].message, '所选图片为空，请选择有内容的图片后重试。')
})

test('读取流时限制真实字节数，而非只信任响应头', async () => {
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(10)); controller.enqueue(new Uint8Array(10)); controller.close() } })
  await assert.rejects(readLimitedBody(new Response(stream, { headers: { 'content-length': '1' } }), 15), AppError)
  await assert.rejects(readLimitedBody(new Response('small', { headers: { 'content-length': '100' } }), 10), AppError)
  assert.equal((await readLimitedBody(new Response('hello'), 5)).byteLength, 5)
})

test('非 JSON 请求被拒绝', async () => {
  await assert.rejects(readJson(new Request('https://example.com', { method: 'POST', body: 'x' })), AppError)
})

test('真实图片解码并重新编码，伪装 SVG 和无效内容被拒绝', async () => {
  const png = await sharp({ create: { width: 32, height: 20, channels: 3, background: '#3159dc' } }).png().toBuffer()
  const result = await prepareImage(png)
  assert.equal(result.width, 32)
  assert.equal(result.height, 20)
  assert.equal(result.mediaType, 'image/png')
  await assert.rejects(prepareImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')), AppError)
  await assert.rejects(prepareImage(Buffer.from('not an image')), AppError)
  assert.equal(safeImageName('../bad\r\n.png').includes('\n'), false)
})

test('兼容 Base64 图像响应，并拒绝无效数据与私网下载链接', async () => {
  const encoded = Buffer.from('test-image-bytes').toString('base64')
  assert.equal(validateImageBase64(encoded), encoded)
  assert.throws(() => validateImageBase64('invalid!'), AppError)
  const response = await normalizeImageResponse(Response.json({ data: [{ b64_json: encoded }], ignored: 'not forwarded' }), 1)
  assert.deepEqual(await response.json(), { data: [{ b64_json: encoded }] })
  await assert.rejects(normalizeImageResponse(Response.json({ data: [] }), 1), AppError)
  await assert.rejects(normalizeImageResponse(Response.json({ data: [{ b64_json: encoded }, { b64_json: encoded }] }), 1), AppError)
  await assert.rejects(normalizeImageResponse(Response.json({ data: [{ url: 'https://127.0.0.1/image.png' }] }), 1), AppError)
})

test('仅信任当前应用的精确来源，拒绝缺失或跨站 Origin', () => {
  const allowed = applicationOrigins({ NODE_ENV: 'development', V0_RUNTIME_URL: 'https://my-preview.example.com', V0_BUILD_URL: 'https://one.v0.build' })
  assert.doesNotThrow(() => assertSameOrigin(new Request('https://my-preview.example.com/api', { method: 'POST', headers: { origin: 'https://my-preview.example.com' } }), allowed))
  for (const origin of ['', 'null', 'https://other.v0.build', 'https://my-preview.example.com.evil.test']) {
    assert.throws(() => assertSameOrigin(new Request('https://my-preview.example.com/api', { method: 'POST', headers: origin ? { origin } : {} }), allowed), AppError)
  }
})

test('生产环境不会信任开发预览域名或 localhost', () => {
  const allowed = applicationOrigins({ NODE_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'studio.example.com', V0_RUNTIME_URL: 'https://dev.v0.build' })
  assert.equal(allowed.has('https://studio.example.com'), true)
  assert.equal(allowed.has('https://dev.v0.build'), false)
  assert.equal(allowed.has('http://localhost:3000'), false)
})

test('服务商错误保持安全提示，不包含原始响应', () => {
  assert.equal(providerStatusError(401).status, 422)
  assert.equal(providerStatusError(429).status, 429)
  assert.equal(providerStatusError(500).status, 502)
})
