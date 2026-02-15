"use client"

import { useState, useCallback, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useUndoAction } from "@/hooks/use-undo-action"
import { Upload, FileIcon, ImageIcon, Trash2, Download, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "@/lib/format"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"]
const ALLOWED_MIME_EXACT = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]

function isAllowedMime(mimeType: string): boolean {
  if (ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return true
  if (ALLOWED_MIME_EXACT.includes(mimeType)) return true
  return false
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface TaskDetailAttachmentsProps {
  taskId: Id<"tasks">
  isAdmin: boolean
  currentUserId: Id<"users">
}

export function TaskDetailAttachments({ taskId, isAdmin, currentUserId }: TaskDetailAttachmentsProps) {
  const attachments = useQuery(api.attachments.list, { taskId })
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl)
  const createAttachment = useMutation(api.attachments.create)
  const removeAttachment = useMutation(api.attachments.remove)
  const { execute: undoExecute } = useUndoAction()
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const count = attachments?.length ?? 0

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)

      // Client-side validation
      for (const file of fileArray) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" exceeds 10 MB limit`)
          return
        }
        if (!isAllowedMime(file.type)) {
          toast.error(`"${file.name}" is not an allowed file type`)
          return
        }
      }

      if (count + fileArray.length > 20) {
        toast.error(`Maximum 20 files per task (currently ${count})`)
        return
      }

      setUploading(true)
      try {
        for (const file of fileArray) {
          const url = await generateUploadUrl()
          const result = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          })
          const { storageId } = await result.json()
          await createAttachment({
            taskId,
            storageId,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
          })
        }
        toast.success(`Uploaded ${fileArray.length} file${fileArray.length > 1 ? "s" : ""}`)
      } catch (err: unknown) {
        toast.error((err as Error).message)
      } finally {
        setUploading(false)
      }
    },
    [taskId, count, generateUploadUrl, createAttachment],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files)
      }
    },
    [uploadFiles],
  )

  const handleDelete = useCallback(
    (id: Id<"attachments">, fileName: string) => {
      undoExecute({
        id: `delete-attachment-${id}`,
        message: `Deleted "${fileName}"`,
        action: async () => {
          await removeAttachment({ id })
        },
      })
    },
    [removeAttachment, undoExecute],
  )

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-2">
        Files ({count}/20)
      </h3>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Uploading…
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mb-2">
              Drop files here or
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5 mr-1.5" />
              Upload files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={(e) => {
                if (e.target.files?.length) {
                  uploadFiles(e.target.files)
                  e.target.value = ""
                }
              }}
            />
          </>
        )}
      </div>

      {/* File list */}
      {attachments && attachments.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {attachments.map((a) => {
            const isImage = a.mimeType.startsWith("image/")
            const canDelete = a.uploadedBy === currentUserId || isAdmin

            return (
              <div key={a._id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                {isImage && a.url ? (
                  <img
                    src={a.url}
                    alt={a.fileName}
                    className="size-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={a.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={!isImage ? a.fileName : undefined}
                    className="font-medium truncate block hover:underline"
                  >
                    {a.fileName}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(a.size)} · {a.uploaderName} · {formatDistanceToNow(a._creationTime)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" download={a.fileName}>
                    <Button variant="ghost" size="icon" className="size-7" aria-label="Download">
                      <Download className="size-3.5" />
                    </Button>
                  </a>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(a._id as Id<"attachments">, a.fileName)}
                      aria-label="Delete file"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
