import { useEffect, useState } from 'react'
import { Folder, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChatFolder } from '../../services/api'

type DialogMode = 'create' | 'rename' | 'move'

interface Props {
  open: boolean
  mode: DialogMode
  folders: ChatFolder[]
  folder?: ChatFolder | null
  currentFolderId?: string | null
  onClose: () => void
  onSubmit: (value: string | null) => void
}

export default function ChatFolderDialog({ open, mode, folders, folder, currentFolderId, onClose, onSubmit }: Props) {
  const { t } = useTranslation('common')
  const [name, setName] = useState(folder?.name || '')
  const [selectedFolder, setSelectedFolder] = useState(currentFolderId || '')

  useEffect(() => {
    setName(folder?.name || '')
    setSelectedFolder(currentFolderId || '')
  }, [folder, currentFolderId, open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const title = mode === 'create'
    ? t('chat.folderDialog.createTitle')
    : mode === 'rename'
      ? t('chat.folderDialog.renameTitle')
      : t('chat.folderDialog.moveTitle')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit(mode === 'move' ? selectedFolder || null : name.trim())
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="chat-folder-dialog-title" className="theme-menu w-full max-w-md rounded-2xl p-5 shadow-2xl">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--accent)] text-[color:var(--primary)]"><Folder className="h-5 w-5" /></span>
            <div><h2 id="chat-folder-dialog-title" className="font-heading text-lg font-bold text-[color:var(--text)]">{title}</h2><p className="text-sm text-[color:var(--text-muted)]">{mode === 'move' ? t('chat.folderDialog.moveHelp') : t('chat.folderDialog.nameHelp')}</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('chat.folderDialog.close')} className="rounded-lg p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--accent)]"><X className="h-4 w-4" /></button>
        </header>

        {mode === 'move' ? (
          <label className="block text-sm font-semibold text-[color:var(--text)]">{t('chat.folderDialog.chooseFolder')}
            <select autoFocus value={selectedFolder} onChange={(event) => setSelectedFolder(event.target.value)} className="input mt-2 w-full border-[color:var(--border)] bg-[color:var(--card-glass)] text-[color:var(--text)]">
              <option value="">{t('chat.folderDialog.unfiled')}</option>
              {folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : (
          <label className="block text-sm font-semibold text-[color:var(--text)]">{t('chat.folderDialog.folderName')}
            <input autoFocus required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} className="input mt-2 w-full border-[color:var(--border)] bg-[color:var(--card-glass)] text-[color:var(--text)]" />
          </label>
        )}

        <footer className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline btn-md">{t('chat.folderDialog.cancel')}</button>
          <button type="submit" disabled={mode !== 'move' && !name.trim()} className="btn btn-primary btn-md">{t('chat.folderDialog.save')}</button>
        </footer>
      </form>
    </div>
  )
}
