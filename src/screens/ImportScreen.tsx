import { useState, type ChangeEvent } from 'react'
import { importProducts, previewProductsCsv, type ImportPreview } from '../data/import'
import { db } from '../db'
import { Notice, Screen } from '../ui'
import { btn, errorMessage } from '../ui-kit'

const EXAMPLE = `name,price,cost,stock,lowStockAt,packSize,favorite
Coke 1.5L,75,62,14,4,,yes
Marlboro Red,9,8.25,46,20,20,yes`

export function ImportScreen() {
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [imported, setImported] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImported(null)
    setError('')
    const names = (await db.products.toArray()).map((product) => product.name)
    setPreview(previewProductsCsv(await file.text(), names))
  }

  async function runImport() {
    if (!preview) return
    setSaving(true)
    try {
      setImported(await importProducts(db, preview.rows))
      setPreview(null)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen title="Import products" back>
      <p className="text-sm text-slate-700">
        Make a spreadsheet in Google Sheets or Excel with these columns, then download it as CSV.
        Only <b>name</b> and <b>price</b> are required. Prices are in pesos.
      </p>
      <pre className="overflow-x-auto rounded-xl bg-slate-100 p-3 text-xs">{EXAMPLE}</pre>
      <label className={`${btn.primary} block`}>
        Choose CSV file
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={pickFile} />
      </label>

      {preview && (
        <>
          <Notice tone={preview.rows.length > 0 ? 'good' : 'warn'}>
            ✓ {preview.rows.length} products ready to import
          </Notice>
          {preview.errors.map((rowError) => (
            <Notice key={`e${rowError.line}`} tone="bad">
              Line {rowError.line}: {rowError.message}
            </Notice>
          ))}
          {preview.duplicates.map((duplicate) => (
            <Notice key={`d${duplicate.line}`} tone="warn">
              Line {duplicate.line}: {duplicate.name} already exists (skipped)
            </Notice>
          ))}
          <button
            type="button"
            className={btn.primary}
            disabled={saving || preview.rows.length === 0}
            onClick={runImport}
          >
            Import {preview.rows.length} products
          </button>
        </>
      )}
      {imported !== null && <Notice tone="good">Imported {imported} products.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
    </Screen>
  )
}
