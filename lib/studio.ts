export type StudioView = 'create' | 'templates' | 'history' | 'favorites' | 'connections'
export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'
export type ModelInfo = { id: string; imageLikely: boolean; source: 'discovered' | 'manual' }
export type Connection = { id: string; name: string; baseUrl: string; keyHint: string; models: ModelInfo[]; createdAt: string }
export type MediaAsset = { id: string; name: string; width: number; height: number; url: string }
export type Generation = {
  id: string
  connectionId: string
  model: string
  prompt: string
  negativePrompt: string
  size: ImageSize
  count: number
  status: 'queued' | 'running' | 'completed' | 'failed'
  error: string | null
  favorite: boolean
  createdAt: string
  assets: MediaAsset[]
  references: MediaAsset[]
}
export type StudioStatus = {
  ready: boolean
  database: boolean
  storage: boolean
  security: boolean
  user: { id: string; name: string; email: string } | null
}
export type Draft = {
  prompt: string
  negativePrompt: string
  size: ImageSize
  count: number
  connectionId: string
  model: string
  references: MediaAsset[]
}
export type Inspiration = { id: string; title: string; category: string; image: string; prompt: string; size: ImageSize }

export const inspirations: Inspiration[] = [
  {
    id: 'architecture',
    title: '海岸建筑 · 静谧之间',
    category: '建筑空间',
    image: '/images/architecture-study.png',
    prompt: '一座坐落于地中海岸边的极简主义建筑，温润的浅色石材，巨大的圆形开窗，远处是澄澈的海面与层叠的山峦。午后的阳光穿过建筑，落下柔和的光影。建筑摄影，电影质感，自然色彩，精致细节。',
    size: '1536x1024',
  },
  {
    id: 'product',
    title: '蔚蓝香氛 · 光影叙事',
    category: '产品摄影',
    image: '/images/product-study.png',
    prompt: '一瓶磨砂钴蓝色玻璃香水，银色瓶盖，置于浅色石灰岩台座。淡蓝色背景，清透的折射与利落的侧光，细腻的材质，克制的构图。高端产品摄影，无文字，无水印。',
    size: '1024x1024',
  },
  {
    id: 'landscape',
    title: '山野来信 · 远离日常',
    category: '自然风景',
    image: '/images/landscape-study.png',
    prompt: '晨雾笼罩的阿尔卑斯山间，清澈的蓝色湖面倒映着层叠的青山。湖边一座小木屋，前景是自然生长的草木，柔和的清晨阳光。胶片摄影，安静而富有诗意，无人物。',
    size: '1024x1024',
  },
]

export const initialDraft: Draft = {
  prompt: inspirations[0].prompt,
  negativePrompt: '',
  size: '1536x1024',
  count: 1,
  connectionId: '',
  model: '',
  references: [],
}

export const sizeOptions: { value: ImageSize; label: string; ratio: string }[] = [
  { value: '1024x1024', label: '正方形', ratio: '1:1' },
  { value: '1536x1024', label: '横构图', ratio: '3:2' },
  { value: '1024x1536', label: '竖构图', ratio: '2:3' },
]

export const statusLabels: Record<Generation['status'], string> = {
  queued: '排队中', running: '正在生成', completed: '已完成', failed: '生成失败',
}
