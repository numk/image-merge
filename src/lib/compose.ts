export interface SourceImage {
  id: string
  bitmap: ImageBitmap
  name?: string
}

export type BgType = 'transparent' | 'solid' | 'gradient'

export interface ComposeOptions {
  /** 背景（输出画布）高度（像素），图片会在高度上缩放到 bgHeight - 2*padY */
  bgHeight: number
  /** 图片之间的横向间距（像素） */
  gap: number
  /** 左右外边距 */
  padX: number
  /** 上下外边距 */
  padY: number
  /** 最小宽高比（width / height）。为 null 时不强制，画布宽度纯自适应内容 */
  minRatio: number | null

  /** 截图圆角（像素），0 = 直角 */
  radius: number
  /** 是否启用阴影 */
  shadow: boolean
  /** 阴影模糊半径（像素） */
  shadowBlur: number
  /** 阴影不透明度 0~1 */
  shadowOpacity: number

  /** 背景类型 */
  bgType: BgType
  /** 纯色 / 渐变起始色 */
  bgColor: string
  /** 渐变结束色 */
  bgColor2: string
  /** 渐变角度（度） */
  gradientAngle: number
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
  bgHeight: 1296,
  gap: 48,
  padX: 48,
  padY: 48,
  minRatio: 4 / 3,

  radius: 24,
  shadow: true,
  shadowBlur: 40,
  shadowOpacity: 0.35,

  bgType: 'transparent',
  bgColor: '#ffffff',
  bgColor2: '#e9eefc',
  gradientAngle: 135,
}

/**
 * 计算合成布局：背景高度为 bgHeight，图片在高度上缩放到 (bgHeight - 2*padY)
 * （截图较矮时放大、较高时缩小），并排居中放在透明画布上。
 * 若设置了 minRatio 且内容不够宽，则左右补透明边距使画布达到最小横向比例。
 */
export function computeLayout(images: SourceImage[], opts: ComposeOptions): Layout {
  const canvasH = opts.bgHeight
  // 图片高度填满背景高度减去上下边距，至少 1px
  const H = Math.max(1, canvasH - 2 * opts.padY)
  const scaled = images.map((img) => {
    const ratio = img.bitmap.width / img.bitmap.height
    return { w: Math.round(H * ratio), h: H }
  })

  const n = scaled.length
  const contentW = scaled.reduce((sum, s) => sum + s.w, 0) + Math.max(0, n - 1) * opts.gap

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

/** 在上下文中描绘圆角矩形路径（带 roundRect 回退）。 */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** 把 0~1 的不透明度叠加到 hex/rgb 颜色，返回 rgba 字符串。 */
function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (m) {
    let hex = m[1]
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  return `rgba(0, 0, 0, ${a})`
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: ComposeOptions,
): void {
  if (opts.bgType === 'solid') {
    ctx.fillStyle = opts.bgColor
    ctx.fillRect(0, 0, w, h)
  } else if (opts.bgType === 'gradient') {
    const rad = (opts.gradientAngle * Math.PI) / 180
    const cx = w / 2
    const cy = h / 2
    const half = Math.abs(Math.cos(rad)) * (w / 2) + Math.abs(Math.sin(rad)) * (h / 2)
    const dx = Math.cos(rad) * half
    const dy = Math.sin(rad) * half
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
    grad.addColorStop(0, opts.bgColor)
    grad.addColorStop(1, opts.bgColor2)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }
}

/**
 * 将图片按布局绘制到给定 canvas。
 * 支持背景（透明/纯色/渐变）、截图圆角与阴影。
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

  paintBackground(ctx, layout.canvasW, layout.canvasH, opts)

  images.forEach((img, i) => {
    const p = layout.placements[i]

    if (opts.shadow && opts.shadowBlur > 0 && opts.shadowOpacity > 0) {
      ctx.save()
      ctx.shadowColor = withAlpha('#000000', opts.shadowOpacity)
      ctx.shadowBlur = opts.shadowBlur
      ctx.shadowOffsetY = Math.round(opts.shadowBlur * 0.35)
      roundedRectPath(ctx, p.x, p.y, p.w, p.h, opts.radius)
      ctx.fillStyle = '#000'
      ctx.fill()
      ctx.restore()
    }

    ctx.save()
    roundedRectPath(ctx, p.x, p.y, p.w, p.h, opts.radius)
    ctx.clip()
    ctx.drawImage(img.bitmap, p.x, p.y, p.w, p.h)
    ctx.restore()
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
