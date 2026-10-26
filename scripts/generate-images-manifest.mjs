// Сканирует public/data/images/<ID>/* и создаёт public/data/images-manifest.json
// Запускается перед dev/build (см. package.json). Не требует сервера в рантайме —
// это обычный шаг подготовки статических файлов, как и сборка самого проекта.
import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const IMAGES_DIR = join(process.cwd(), 'public', 'data', 'images')
const OUT_FILE = join(process.cwd(), 'public', 'data', 'images-manifest.json')
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

if (!existsSync(IMAGES_DIR)) {
  mkdirSync(IMAGES_DIR, { recursive: true })
}

/** @type {Record<string, string[]>} */
const manifest = {}

const entries = readdirSync(IMAGES_DIR)
for (const id of entries) {
  const idPath = join(IMAGES_DIR, id)
  if (!statSync(idPath).isDirectory()) continue

  const files = readdirSync(idPath)
    .filter((f) => {
      const ext = f.slice(f.lastIndexOf('.')).toLowerCase()
      return ALLOWED_EXT.has(ext)
    })
    .sort((a, b) => a.localeCompare(b, 'ru'))

  if (files.length > 0) {
    manifest[id] = files.map((f) => `data/images/${id}/${f}`)
  }
}

writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2), 'utf-8')
console.log(
  `[images-manifest] Найдено точек с изображениями: ${Object.keys(manifest).length}. Записано в ${OUT_FILE}`
)
