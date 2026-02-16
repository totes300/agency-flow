"use client"

import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Mention from "@tiptap/extension-mention"
import Placeholder from "@tiptap/extension-placeholder"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Toggle } from "@/components/ui/toggle"
import { Button } from "@/components/ui/button"
import { Bold, Italic, Strikethrough, List, SendHorizonal } from "lucide-react"
import tippy, { type Instance as TippyInstance } from "tippy.js"

interface TiptapCommentEditorProps {
  onSubmit: (content: any, mentionedUserIds: string[]) => void
  disabled?: boolean
}

function extractMentionIds(doc: any): string[] {
  const ids: string[] = []
  function walk(node: any) {
    if (node.type === "mention" && node.attrs?.id) {
      ids.push(node.attrs.id)
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child)
      }
    }
  }
  if (doc) walk(doc)
  return [...new Set(ids)]
}

// Mention suggestion list component
class MentionList {
  element: HTMLElement
  items: Array<{ _id: string; name: string }>
  selectedIndex: number
  command: (item: { id: string; label: string }) => void

  constructor(props: any) {
    this.items = props.items
    this.command = props.command
    this.selectedIndex = 0
    this.element = document.createElement("div")
    this.element.className =
      "z-50 rounded-md border bg-popover p-1 text-popover-foreground shadow-md max-h-48 overflow-y-auto"
    this.element.setAttribute("role", "listbox")
    this.element.setAttribute("aria-label", "Mention suggestions")
    this.render()
  }

  render() {
    this.element.innerHTML = ""
    if (this.items.length === 0) {
      const empty = document.createElement("div")
      empty.className = "px-2 py-1.5 text-sm text-muted-foreground"
      empty.textContent = "No users found"
      this.element.appendChild(empty)
      return
    }
    this.items.forEach((item, index) => {
      const btn = document.createElement("button")
      btn.className = `flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none ${
        index === this.selectedIndex ? "bg-accent text-accent-foreground" : ""
      }`
      btn.setAttribute("role", "option")
      btn.setAttribute("aria-selected", String(index === this.selectedIndex))
      btn.textContent = item.name
      btn.addEventListener("click", () => {
        this.command({ id: item._id, label: item.name })
      })
      this.element.appendChild(btn)
    })
  }

  updateProps(props: any) {
    this.items = props.items
    this.command = props.command
    this.selectedIndex = 0
    this.render()
  }

  onKeyDown(event: KeyboardEvent): boolean {
    if (event.key === "ArrowUp") {
      this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length
      this.render()
      return true
    }
    if (event.key === "ArrowDown") {
      this.selectedIndex = (this.selectedIndex + 1) % this.items.length
      this.render()
      return true
    }
    if (event.key === "Enter") {
      const item = this.items[this.selectedIndex]
      if (item) {
        this.command({ id: item._id, label: item.name })
      }
      return true
    }
    return false
  }

  destroy() {
    this.element.remove()
  }
}

export function TiptapCommentEditor({ onSubmit, disabled }: TiptapCommentEditorProps) {
  const users = useQuery(api.users.listAll)
  const usersRef = useRef(users)
  usersRef.current = users

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: "Write a comment… type @ to mention" }),
      Mention.configure({
        HTMLAttributes: {
          class: "text-primary font-medium",
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            const allUsers = usersRef.current ?? []
            return allUsers
              .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 5)
          },
          render: () => {
            let component: MentionList | null = null
            let popup: TippyInstance[] | null = null

            return {
              onStart: (props: any) => {
                component = new MentionList(props)

                if (!props.clientRect) return

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                })
              },
              onUpdate: (props: any) => {
                component?.updateProps(props)
                if (popup?.[0] && props.clientRect) {
                  popup[0].setProps({
                    getReferenceClientRect: props.clientRect,
                  })
                }
              },
              onKeyDown: (props: any) => {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide()
                  return true
                }
                return component?.onKeyDown(props.event) ?? false
              },
              onExit: () => {
                popup?.[0]?.destroy()
                component?.destroy()
              },
            }
          },
        },
      }),
    ],
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[60px] px-3 py-2",
        role: "textbox",
        "aria-label": "Write a comment",
        "aria-multiline": "true",
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          handleSubmit()
          return true
        }
        return false
      },
    },
  })

  const handleSubmit = useCallback(() => {
    if (!editor || editor.isEmpty) return
    const json = editor.getJSON()
    const mentionIds = extractMentionIds(json)
    onSubmit(json, mentionIds)
    editor.commands.clearContent()
  }, [editor, onSubmit])

  if (!editor) return null

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-0.5 border-b px-1 py-1">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold className="size-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic className="size-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("strike")}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <List className="size-3.5" />
        </Toggle>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSubmit}
          disabled={disabled || editor.isEmpty}
          className="gap-1.5"
        >
          <SendHorizonal className="size-3.5" />
          Post
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
