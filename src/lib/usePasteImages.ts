import { useCallback, useEffect, useState } from 'react'
import type { SourceImage } from './compose'

const MAX_IMAGES = 3

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

async function fileToSource(file: File): Promise<SourceImage> {
  const bitmap = await createImageBitmap(file)
  return { id: genId(), bitmap, name: file.name }
}

export function usePasteImages() {
  const [images, setImages] = useState<SourceImage[]>([])
  const [error, setError] = useState<string | null>(null)

  const addFiles = useCallback(async (incoming: File[] | FileList) => {
    const files = Array.from(incoming).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return

    setError(null)
    let sources: SourceImage[]
    try {
      sources = await Promise.all(files.map(fileToSource))
    } catch {
      setError('无法读取图片，请换一张试试')
      return
    }

    setImages((prev) => {
      const room = MAX_IMAGES - prev.length
      if (room <= 0) {
        setError(`最多只能添加 ${MAX_IMAGES} 张图片`)
        return prev
      }
      if (sources.length > room) {
        setError(`最多只能添加 ${MAX_IMAGES} 张图片，已忽略多余的`)
      }
      return [...prev, ...sources.slice(0, room)]
    })
  }, [])

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id)
      target?.bitmap.close()
      return prev.filter((i) => i.id !== id)
    })
    setError(null)
  }, [])

  const moveImage = useCallback((from: number, to: number) => {
    setImages((prev) => {
      if (to < 0 || to >= prev.length || from < 0 || from >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setImages((prev) => {
      prev.forEach((i) => i.bitmap.close())
      return []
    })
    setError(null)
  }, [])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        void addFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addFiles])

  return { images, error, addFiles, removeImage, moveImage, clear, max: MAX_IMAGES }
}
