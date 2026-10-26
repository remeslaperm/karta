import { ref } from 'vue'
import * as XLSX from 'xlsx'
import type { MapPoint, RawRow } from '../types/point'

const DATA_URL = './data/points.xlsx'
const IMAGES_MANIFEST_URL = './data/images-manifest.json'

/**
 * Пытается вытащить первое валидное число (широту/долготу) из значения ячейки.
 * В части строк координата может быть текстом с несколькими значениями —
 * в этом случае берём первое число, но такую точку стоит проверить вручную.
 */
function parseCoordinate(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const match = value.replace(',', '.').match(/-?\d+(\.\d+)?/)
  if (!match) return null
  const num = parseFloat(match[0])
  return Number.isFinite(num) ? num : null
}

async function loadImagesManifest(): Promise<Record<string, string[]>> {
  try {
    const res = await fetch(IMAGES_MANIFEST_URL)
    if (!res.ok) return {}
    return (await res.json()) as Record<string, string[]>
  } catch {
    return {}
  }
}

async function loadPointsFromXlsx(): Promise<{ points: MapPoint[]; warnings: string[] }> {
  const warnings: string[] = []
  const [fileRes, imagesManifest] = await Promise.all([
    fetch(DATA_URL),
    loadImagesManifest(),
  ])

  if (!fileRes.ok) {
    throw new Error(`Не удалось загрузить файл данных: ${DATA_URL} (${fileRes.status})`)
  }

  const buffer = await fileRes.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' })

  const points: MapPoint[] = []

  rows.forEach((row, index) => {
    const id = String(row.ID ?? '').trim()
    if (!id) {
      warnings.push(`Строка ${index + 2}: пропущена — не заполнен ID.`)
      return
    }

    const lat = parseCoordinate(row.широта)
    const lng = parseCoordinate(row.долгота)

    if (lat === null || lng === null) {
      warnings.push(`Строка ${index + 2} (ID: ${id}): не удалось распознать координаты, точка пропущена.`)
      return
    }

    points.push({
      id,
      title: String(row.Заголовок ?? '').trim(),
      description: String(row.Описание ?? '').trim(),
      category: String(row.Категория ?? '').trim() || 'Без категории',
      lat,
      lng,
      images: imagesManifest[id] ?? [],
    })
  })

  return { points, warnings }
}

export function usePointsData() {
  const points = ref<MapPoint[]>([])
  const warnings = ref<string[]>([])
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      const result = await loadPointsFromXlsx()
      points.value = result.points
      warnings.value = result.warnings
      if (result.warnings.length) {
        console.warn('[usePointsData] Предупреждения при разборе данных:', result.warnings)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Неизвестная ошибка при загрузке данных'
    } finally {
      isLoading.value = false
    }
  }

  return { points, warnings, isLoading, error, load }
}
