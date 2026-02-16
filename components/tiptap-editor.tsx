"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Placeholder from "@tiptap/extension-placeholder"
import { Toggle } from "@/components/ui/toggle"
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
} from "lucide-react"

interface TiptapEditorProps {
  content: any
  onUpdate: (json: any) => void
  placeholder?: string
  editable?: boolean
  toolbar?: boolean
}

export function TiptapEditor({
  content,
  onUpdate,
  placeholder = "Write something…",
  editable = true,
  toolbar = true,
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
          HTMLAttributes: {
            class: "tiptap-heading",
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: "list-disc",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal",
          },
        },
        code: {
          HTMLAttributes: {
            class: "tiptap-inline-code",
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class: "tiptap-code-block",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "tiptap-blockquote",
          },
        },
        horizontalRule: {
          HTMLAttributes: {
            class: "tiptap-hr",
          },
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "tiptap-task-list",
        },
      }),
      TaskItem.configure({
        nested: false,
        HTMLAttributes: {
          class: "tiptap-task-item",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: editable ? "tiptap tiptap-editable focus:outline-none" : "tiptap tiptap-readonly",
        role: "textbox",
        "aria-label": placeholder,
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON())
    },
  })

  // Sync content when prop changes (e.g. switching between tasks)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (editor.isFocused) return // Don't disrupt active typing

    const currentJson = JSON.stringify(editor.getJSON())
    const newJson = JSON.stringify(content)
    if (currentJson !== newJson) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [editor, content])

  if (!editor) return null

  if (!editable || !toolbar) {
    return <EditorContent editor={editor} />
  }

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("strike")}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          aria-label="Strikethrough"
        >
          <Strikethrough className="size-4" />
        </Toggle>

        <div className="mx-1 h-4 w-px bg-border" />

        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 1 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label="Heading 1"
        >
          <Heading1 className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Heading 2"
        >
          <Heading2 className="size-4" />
        </Toggle>

        <div className="mx-1 h-4 w-px bg-border" />

        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <List className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={!editor.can().chain().focus().toggleOrderedList().run()}
          aria-label="Ordered list"
        >
          <ListOrdered className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("taskList")}
          onPressedChange={() => editor.chain().focus().toggleTaskList().run()}
          aria-label="Task list"
        >
          <ListChecks className="size-4" />
        </Toggle>

        <div className="mx-1 h-4 w-px bg-border" />

        <Toggle
          size="sm"
          pressed={editor.isActive("blockquote")}
          onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={!editor.can().chain().focus().toggleBlockquote().run()}
          aria-label="Blockquote"
        >
          <Quote className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("code")}
          onPressedChange={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          aria-label="Code"
        >
          <Code className="size-4" />
        </Toggle>

        <div className="mx-1 h-4 w-px bg-border" />

        <Toggle
          size="sm"
          pressed={false}
          onPressedChange={() => editor.chain().focus().setHorizontalRule().run()}
          aria-label="Horizontal rule"
        >
          <Minus className="size-4" />
        </Toggle>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
