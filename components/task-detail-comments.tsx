"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { useUndoAction } from "@/hooks/use-undo-action"
import { formatDistanceToNow } from "@/lib/format"
import { TiptapEditor } from "@/components/tiptap-editor"
import { TiptapCommentEditor } from "@/components/tiptap-comment-editor"
import { Trash2 } from "lucide-react"

interface TaskDetailCommentsProps {
  taskId: Id<"tasks">
  isAdmin: boolean
  currentUserId: Id<"users">
}

function userInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function TaskDetailComments({ taskId, isAdmin, currentUserId }: TaskDetailCommentsProps) {
  const [allComments, setAllComments] = useState<any[]>([])
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [prevTaskId, setPrevTaskId] = useState(taskId)
  const result = useQuery(api.comments.list, { taskId, paginationOpts: cursor ? { cursor } : undefined })
  const createComment = useMutation(api.comments.create)
  const removeComment = useMutation(api.comments.remove)
  const { execute: undoExecute } = useUndoAction()

  // Reset accumulated comments when taskId changes
  if (taskId !== prevTaskId) {
    setPrevTaskId(taskId)
    setAllComments([])
    setCursor(undefined)
  }

  // Accumulate pages
  const currentPage = result?.page ?? []
  const isDone = result?.isDone ?? true

  // Merge: first page replaces, subsequent pages append
  const comments = cursor === undefined ? currentPage : [...allComments, ...currentPage]

  const handleSubmit = useCallback(
    async (content: any, mentionedUserIds: string[]) => {
      try {
        await createComment({
          taskId,
          content,
          mentionedUserIds: mentionedUserIds as Id<"users">[],
        })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    },
    [taskId, createComment],
  )

  const handleDelete = useCallback(
    (commentId: Id<"comments">, userName: string) => {
      undoExecute({
        id: `delete-comment-${commentId}`,
        message: `Deleted comment by ${userName}`,
        action: async () => {
          await removeComment({ id: commentId })
        },
      })
    },
    [removeComment, undoExecute],
  )

  return (
    <div className="space-y-4">
      {/* Comment list */}
      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet</p>
      )}

      {/* Show newest first — reverse for display (oldest at top) */}
      {[...comments].reverse().map((comment) => {
        const canDelete = comment.userId === currentUserId || isAdmin

        return (
          <div key={comment._id} className="group flex gap-3">
            <Avatar className="size-7 shrink-0 mt-0.5">
              <AvatarImage src={comment.userAvatarUrl} />
              <AvatarFallback className="text-xs">
                {userInitials(comment.userName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">{comment.userName}</span>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(comment._creationTime)}
                </span>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                    onClick={() => handleDelete(comment._id as Id<"comments">, comment.userName)}
                    aria-label="Delete comment"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
              <div className="text-sm mt-0.5">
                <TiptapEditor
                  content={comment.content}
                  onUpdate={() => {}}
                  editable={false}
                  toolbar={false}
                />
              </div>
            </div>
          </div>
        )
      })}

      {!isDone && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => {
          if (currentPage.length > 0) {
            setAllComments(comments)
            setCursor(String(currentPage[currentPage.length - 1]._creationTime))
          }
        }}>
          Load more
        </Button>
      )}

      {/* New comment editor */}
      <TiptapCommentEditor onSubmit={handleSubmit} />
    </div>
  )
}
