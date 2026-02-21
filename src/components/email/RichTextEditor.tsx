import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Bold, Italic, List, ListOrdered, Undo, Redo } from 'lucide-react';
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
