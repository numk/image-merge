import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_OPTIONS,
  exportToBlob,
  renderToCanvas,
  type BgType,
  type ComposeOptions,
  type SourceImage,
} from './lib/compose'
import { usePasteImages } from './lib/usePasteImages'
import './App.css'

const RATIO_PRESETS: { label: string; value: number | null }[] = [
  { label: '4 : 3', value: 4 / 3 },
  { label: '3 : 2', value: 3 / 2 },
  { label: '16 : 9', value: 16 / 9 },
  { label: '不强制', value: null },
]

const BG_PRESETS: { label: string; value: BgType }[] = [
  { label: '透明', value: 'transparent' },
  { label: '纯色', value: 'solid' },
  { label: '渐变', value: 'gradient' },
]

function Thumb({ bitmap }: { bitmap: ImageBitmap }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const maxH = 88
    const ratio = bitmap.width / bitmap.height
    c.height = maxH
    c.width = Math.round(maxH * ratio)
    const ctx = c.getContext('2d')
    ctx?.drawImage(bitmap, 0, 0, c.width, c.height)
  }, [bitmap])
  return <canvas ref={ref} className="thumb-canvas" />
}

export default function App() {
  const { images, error, addFiles, removeImage, moveImage, clear, max } =
    usePasteImages()
  const [options, setOptions] = useState<ComposeOptions>(DEFAULT_OPTIONS)
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [outSize, setOutSize] = useState<{ w: number; h: number } | null>(null)

  const previewRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const update = useCallback(
    <K extends keyof ComposeOptions>(key: K, value: ComposeOptions[K]) => {
      setOptions((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas) return
    if (images.length === 0) {
      canvas.width = 0
      canvas.height = 0
      setOutSize(null)
      return
    }
    const layout = renderToCanvas(canvas, images as SourceImage[], options)
    setOutSize({ w: layout.canvasW, h: layout.canvasH })
  }, [images, options])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  const handleCopy = useCallback(async () => {
    if (images.length === 0) return
    try {
      const blob = await exportToBlob(images as SourceImage[], options)
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      setStatus('已复制到剪贴板')
    } catch {
      setStatus('复制失败：浏览器可能不支持，请改用下载')
    }
  }, [images, options])

  const handleDownload = useCallback(async () => {
    if (images.length === 0) return
    try {
      const blob = await exportToBlob(images as SourceImage[], options)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `merged-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
      setStatus('已下载 PNG')
    } catch {
      setStatus('下载失败，请重试')
    }
  }, [images, options])

  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 2500)
    return () => clearTimeout(t)
  }, [status])

  const hasImages = images.length > 0
  const ratioValue = useMemo(
    () =>
      RATIO_PRESETS.find((p) => p.value === options.minRatio)?.label ??
      '自定义',
    [options.minRatio],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>截图横向排版工具</h1>
        <p className="subtitle">
          粘贴 1~{max} 张竖屏截图，合成为横向透明 PNG，少占文档纵向空间。全程本地处理，不上传。
        </p>
      </header>

      <main className="layout">
        <section className="panel">
          <div
            className={`dropzone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="dropzone-inner">
              <strong>Ctrl/⌘ + V 粘贴</strong>
              <span>或 点击选择 / 拖拽图片到此</span>
              <small>
                {images.length}/{max} 张
              </small>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {error && <div className="alert">{error}</div>}

          {hasImages && (
            <ul className="thumbs">
              {images.map((img, i) => (
                <li key={img.id} className="thumb">
                  <Thumb bitmap={img.bitmap} />
                  <div className="thumb-actions">
                    <button
                      title="左移"
                      disabled={i === 0}
                      onClick={() => moveImage(i, i - 1)}
                    >
                      ◀
                    </button>
                    <button
                      title="右移"
                      disabled={i === images.length - 1}
                      onClick={() => moveImage(i, i + 1)}
                    >
                      ▶
                    </button>
                    <button
                      title="删除"
                      className="danger"
                      onClick={() => removeImage(img.id)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="controls">
            <label className="field">
              <span>
                背景高度 <em>{options.bgHeight}px</em>
                <small className="hint">
                  图片高度 {Math.max(1, options.bgHeight - 2 * options.padY)}px
                </small>
              </span>
              <input
                type="range"
                min={400}
                max={2400}
                step={50}
                value={options.bgHeight}
                onChange={(e) => update('bgHeight', Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span>
                图片间距 <em>{options.gap}px</em>
              </span>
              <input
                type="range"
                min={0}
                max={200}
                step={4}
                value={options.gap}
                onChange={(e) => update('gap', Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span>
                左右边距 <em>{options.padX}px</em>
              </span>
              <input
                type="range"
                min={0}
                max={300}
                step={4}
                value={options.padX}
                onChange={(e) => update('padX', Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span>
                上下边距 <em>{options.padY}px</em>
              </span>
              <input
                type="range"
                min={0}
                max={300}
                step={4}
                value={options.padY}
                onChange={(e) => update('padY', Number(e.target.value))}
              />
            </label>

            <div className="field">
              <span>
                最小横向比例 <em>{ratioValue}</em>
              </span>
              <div className="ratio-group">
                {RATIO_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className={options.minRatio === p.value ? 'active' : ''}
                    onClick={() => update('minRatio', p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="group-title">美化</div>

            <label className="field">
              <span>
                截图圆角 <em>{options.radius}px</em>
              </span>
              <input
                type="range"
                min={0}
                max={120}
                step={2}
                value={options.radius}
                onChange={(e) => update('radius', Number(e.target.value))}
              />
            </label>

            <label className="field check-field">
              <input
                type="checkbox"
                checked={options.shadow}
                onChange={(e) => update('shadow', e.target.checked)}
              />
              <span>启用阴影</span>
            </label>

            {options.shadow && (
              <>
                <label className="field">
                  <span>
                    阴影模糊 <em>{options.shadowBlur}px</em>
                    {options.shadowBlur > options.padX ||
                    options.shadowBlur > options.padY ? (
                      <small className="hint">阴影可能被边距裁切，建议调大边距</small>
                    ) : null}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={120}
                    step={2}
                    value={options.shadowBlur}
                    onChange={(e) => update('shadowBlur', Number(e.target.value))}
                  />
                </label>

                <label className="field">
                  <span>
                    阴影浓度 <em>{Math.round(options.shadowOpacity * 100)}%</em>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(options.shadowOpacity * 100)}
                    onChange={(e) =>
                      update('shadowOpacity', Number(e.target.value) / 100)
                    }
                  />
                </label>
              </>
            )}

            <div className="field">
              <span>背景</span>
              <div className="ratio-group">
                {BG_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    className={options.bgType === p.value ? 'active' : ''}
                    onClick={() => update('bgType', p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {options.bgType === 'solid' && (
              <label className="field color-row">
                <span>背景颜色</span>
                <input
                  type="color"
                  value={options.bgColor}
                  onChange={(e) => update('bgColor', e.target.value)}
                />
              </label>
            )}

            {options.bgType === 'gradient' && (
              <>
                <div className="field color-row">
                  <span>渐变颜色</span>
                  <div className="color-pair">
                    <input
                      type="color"
                      value={options.bgColor}
                      onChange={(e) => update('bgColor', e.target.value)}
                    />
                    <input
                      type="color"
                      value={options.bgColor2}
                      onChange={(e) => update('bgColor2', e.target.value)}
                    />
                  </div>
                </div>
                <label className="field">
                  <span>
                    渐变角度 <em>{options.gradientAngle}°</em>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={15}
                    value={options.gradientAngle}
                    onChange={(e) =>
                      update('gradientAngle', Number(e.target.value))
                    }
                  />
                </label>
              </>
            )}
          </div>

          <div className="actions">
            <button
              className="primary"
              disabled={!hasImages}
              onClick={handleCopy}
            >
              复制到剪贴板
            </button>
            <button disabled={!hasImages} onClick={handleDownload}>
              下载 PNG
            </button>
            <button
              className="ghost"
              disabled={!hasImages}
              onClick={clear}
            >
              清空
            </button>
          </div>
          {status && <div className="status">{status}</div>}
        </section>

        <section className="preview">
          <div className="preview-head">
            <span>预览</span>
            {outSize && (
              <span className="dim">
                {outSize.w} × {outSize.h}px
              </span>
            )}
          </div>
          <div className="preview-stage">
            {hasImages ? (
              <canvas ref={previewRef} className="preview-canvas" />
            ) : (
              <div className="empty">这里会显示合成后的横向图片</div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
