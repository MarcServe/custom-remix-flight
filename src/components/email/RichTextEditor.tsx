import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, forwardRef, useImperativeHandle } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Bold, Italic, List, ListOrdered, Undo, Redo, Link2, Link2Off } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';

export interface RichTextEditorHandle {
  insertImage: (url: string) => void;
}

interface RichTextEditorProps {
  content: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** When true, enables image node and exposes insertImage via ref */
  allowImages?: boolean;
  /** Optional slot to render after the default toolbar (e.g. "Insert Image" button) */
  toolbarExtra?: React.ReactNode;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle | null, RichTextEditorProps>(function RichTextEditor(
  {
    content,
    onChange,
    placeholder = 'Write your message here...',
    disabled = false,
    allowImages = false,
    toolbarExtra,
  },
  ref
) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      // Preserve <a href> on paste/edit — without this, Visual mode strips links
      // and Variant A/B sent HTML loses demo URLs while link text remains.
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          style: 'color:#2563eb;text-decoration:underline;word-break:break-all;',
        },
      }),
      ...(allowImages
        ? [
            Image.configure({
              inline: false,
              allowBase64: false,
              HTMLAttributes: { style: 'max-width:100%;height:auto;border-radius:8px;' },
            }),
          ]
        : []),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      onChange(html, text);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  useImperativeHandle(ref, () => ({
    insertImage(url: string) {
      if (!editor) return;
      const safe = url.replace(/"/g, '&quot;');
      editor.chain().focus().insertContent(`<img src="${safe}" alt="" />`).run();
    },
  }), [editor]);

  // Sync editor content when content prop changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    if (disabled) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const next = window.prompt('Link URL', prev || 'https://');
    if (next === null) return;
    const url = next.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/50 flex-wrap">
        <Toggle
          size="sm"
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <div className="w-px h-6 bg-border mx-1" />
        <Toggle
          size="sm"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
        >
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        <div className="w-px h-6 bg-border mx-1" />
        <Toggle
          size="sm"
          pressed={editor.isActive('link')}
          onPressedChange={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
            } else {
              setLink();
            }
          }}
          disabled={disabled}
          aria-label="Link"
        >
          <Link2 className="h-4 w-4" />
        </Toggle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
          disabled={!editor.isActive('link') || disabled}
          title="Remove link"
        >
          <Link2Off className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo() || disabled}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo() || disabled}
        >
          <Redo className="h-4 w-4" />
        </Button>
        {toolbarExtra}
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
});
