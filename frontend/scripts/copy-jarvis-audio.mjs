import { mkdir, readdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Repo layout:
// - jsvoice/ (repo root)
// - frontend/
//   - scripts/ (this file)
//   - public/
const srcDir = path.resolve(__dirname, '../../jsvoice')
const destDir = path.resolve(__dirname, '../public/jarvis-audio')

async function copyAllFilesFlat(src, dest) {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    await copyFile(from, to)
  }
}

try {
  await copyAllFilesFlat(srcDir, destDir)
  console.log(`[jarvis-audio] Copied wav files from ${srcDir} -> ${destDir}`)
} catch (err) {
  console.warn('[jarvis-audio] Copy skipped/failed:', err?.message || err)
}
