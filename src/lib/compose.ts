export interface SourceImage {
  id: string
  bitmap: ImageBitmap
  name?: string
}

export interface ComposeOptions {
  /** 统一目标高度（像素），所有截图按比例缩放到该高度 */
  targetHeight: number
  /** 图片之间的横向间距（像素，基于 targetHeight 坐标系） */
  gap: number
  /** 左右外边距 */
  padX: number
  /** 上下外边距 */
  padY: number
  /** 最小宽高比（width / height）。为 null 时不强制，画布宽度纯自适应内容 */
  minRatio: number | null
}

export interface Placement {
  x: number
  y: number
  w: number
  h: number
}

export interface Layout {
  canvasW: number
  canvasH: number
  placements: Placement[]
}

export const DEFAULT_OPTIONS: ComposeOptions = {
  targetHeight: 1200,
  gap: 48,
  padX: 48,
  padY: 48,
  minRatio: 4 / 3,
}

/**
 * 计算合成布局：所有图片统一到 targetHeight，并排居中放在透明画布上。
 * 若设置了 minRatio 且内容不够宽，则左右补透明边距使画布达到最小横向比例。
 */
export function computeLayout(images: SourceImage[], opts: ComposeOptions): Layout {
  const H = opts.targetHeight
  const scaled = images.map((img) => {
    const ratio = img.bitmap.width / img.bitmap.height
    return { w: Math.round(H * ratio), h: H }
  })

  const n = scaled.length
  const contentW = scaled.reduce((sum, s) => sum + s.w, 0) + Math.max(0, n - 1) * opts.gap

  const canvasH = H + 2 * opts.padY
  let canvasW = contentW + 2 * opts.padX

  if (opts.minRatio != null) {
    const minW = Math.round(canvasH * opts.minRatio)
    if (canvasW < minW) canvasW = minW
  }

  // 内容整体水平、垂直居中
  const startX = Math.round((canvasW - contentW) / 2)
  const y = Math.round((canvasH - H) / 2)

  const placements: Placement[] = []
  let cursorX = startX
  for (const s of scaled) {
    placements.push({ x: cursorX, y, w: s.w, h: s.h })
    cursorX += s.w + opts.gap
  }

  return { canvasW, canvasH, placements }
}

/**
 * 将图片按布局绘制到给定 canvas（背景保持透明）。
 * 返回实际布局，便于调用方获取画布尺寸。
 */
export function renderToCanvas(
  canvas: HTMLCanvasElement,
  images: SourceImage[],
  opts: ComposeOptions,
): Layout {
  const layout = computeLayout(images, opts)
  canvas.width = layout.canvasW
  canvas.height = layout.canvasH

  const ctx = canvas.getContext('2d')
  if (!ctx) return layout

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  images.forEach((img, i) => {
    const p = layout.placements[i]
    ctx.drawImage(img.bitmap, p.x, p.y, p.w, p.h)
  })

  return layout
}

/** 离屏渲染并导出为 PNG Blob（保留透明通道）。 */
export async function exportToBlob(
  images: SourceImage[],
  opts: ComposeOptions,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  renderToCanvas(canvas, images, opts)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('导出 PNG 失败'))
    }, 'image/png')
  })
}
