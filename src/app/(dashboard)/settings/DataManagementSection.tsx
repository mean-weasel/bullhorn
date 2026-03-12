'use client'

import { useState, useRef } from 'react'
import { Download, Upload, Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ExportFormat = 'json' | 'csv'
type ExportType = 'all' | 'posts' | 'campaigns'

interface ImportResult {
  imported: { posts: number; campaigns: number }
  skipped: { posts: number; campaigns: number }
}

export function DataManagementSection() {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [exportType, setExportType] = useState<ExportType>('all')
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const params = new URLSearchParams({ format: exportFormat, type: exportType })
      const res = await fetch(`/api/export?${params}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Export failed')
      }

      if (exportFormat === 'csv') {
        const text = await res.text()
        downloadFile(text, `bullhorn-export.csv`, 'text/csv')
      } else {
        const data = await res.json()
        const json = JSON.stringify(data, null, 2)
        downloadFile(json, `bullhorn-export.json`, 'application/json')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setError(null)
    setImportResult(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Import failed')
      }

      const result = await res.json()
      setImportResult(result)
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON file. Please select a valid Bullhorn export file.')
      } else {
        setError((err as Error).message)
      }
    } finally {
      setImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        <Download className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Data Management
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Export your posts and campaigns, or import data from a previous export.
      </p>

      {/* Export Section */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-foreground mb-3">Export</h3>
        <div className="flex flex-wrap gap-3 mb-3">
          {/* Format selector */}
          <div className="flex gap-1">
            {(['json', 'csv'] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setExportFormat(fmt)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-bold uppercase',
                  'border-2 transition-all',
                  exportFormat === fmt
                    ? 'border-border bg-primary text-primary-foreground shadow-sticker-hover'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Type selector */}
          <div className="flex gap-1">
            {(['all', 'posts', 'campaigns'] as ExportType[]).map((t) => (
              <button
                key={t}
                onClick={() => setExportType(t)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-bold capitalize',
                  'border-2 transition-all',
                  exportType === t
                    ? 'border-border bg-secondary text-foreground shadow-sticker-hover'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-md',
            'bg-primary text-primary-foreground font-bold text-sm',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'hover:-translate-y-px hover:shadow-sticker',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
            'transition-all'
          )}
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {exporting ? 'Exporting...' : 'Download Export'}
        </button>
      </div>

      {/* Divider */}
      <div className="border-t-2 border-border mb-6" />

      {/* Import Section */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Import</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Upload a JSON file from a previous Bullhorn export. Duplicate entries will be skipped.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
          id="import-file"
        />
        <label
          htmlFor="import-file"
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-md cursor-pointer inline-flex',
            'bg-secondary text-foreground font-bold text-sm',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'hover:-translate-y-px hover:shadow-sticker',
            'transition-all',
            importing && 'opacity-50 pointer-events-none'
          )}
        >
          {importing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {importing ? 'Importing...' : 'Upload JSON File'}
        </label>

        {/* Import Results */}
        {importResult && (
          <div className="mt-4 p-3 rounded-md bg-sticker-green/10 border-2 border-sticker-green/30 text-sm">
            <div className="flex items-center gap-2 font-bold text-sticker-green mb-1">
              <Check className="w-4 h-4" />
              Import Complete
            </div>
            <div className="text-muted-foreground space-y-0.5">
              <div>
                Posts: {importResult.imported.posts} imported, {importResult.skipped.posts} skipped
              </div>
              <div>
                Campaigns: {importResult.imported.campaigns} imported,{' '}
                {importResult.skipped.campaigns} skipped
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border-2 border-destructive/30 text-sm font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
