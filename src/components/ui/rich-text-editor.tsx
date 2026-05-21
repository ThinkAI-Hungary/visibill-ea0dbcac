import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import { Bold, Italic, List, ListOrdered, Heading2, Undo, Redo, Pilcrow } from 'lucide-react';

interface RichTextEditorProps {
  /** Initial content (plain text or HTML). Only used on mount. */
  initialContent: string;
  /** Called on every change with the current HTML. */
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

function MenuBar({ editor }: { editor: any }) {
  if (!editor) return null;

  const btnCn = (active: boolean) =>
    cn(
      'p-1.5 rounded-md transition-colors',
      active
        ? 'bg-primary/15 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    );

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/40 bg-muted/20 flex-wrap">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnCn(editor.isActive('bold'))} title="Félkövér">
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnCn(editor.isActive('italic'))} title="Dőlt">
        <Italic className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-border/50 mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnCn(editor.isActive('heading', { level: 3 }))} title="Alcím">
        <Heading2 className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={btnCn(editor.isActive('paragraph'))} title="Bekezdés">
        <Pilcrow className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-border/50 mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnCn(editor.isActive('bulletList'))} title="Lista">
        <List className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnCn(editor.isActive('orderedList'))} title="Számozott lista">
        <ListOrdered className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-border/50 mx-1" />
      <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={cn(btnCn(false), 'disabled:opacity-30')} title="Visszavonás">
        <Undo className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={cn(btnCn(false), 'disabled:opacity-30')} title="Újra">
        <Redo className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function toHtml(text: string): string {
  if (!text) return '<p></p>';
  if (text.startsWith('<')) return text;
  return `<p>${text.replace(/\n/g, '</p><p>')}</p>`;
}

/**
 * Fully UNCONTROLLED Rich Text Editor.
 * 
 * - `initialContent` is only read on mount. 
 * - To force a reset (e.g. "Restore defaults"), change the `key` prop on this component.
 * - `onChange` fires on every edit with the current HTML.
 */
export function RichTextEditor({ initialContent, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || 'Kezdj el gépelni...' }),
    ],
    content: toHtml(initialContent),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[120px] px-3 py-2 text-sm',
      },
    },
  });

  return (
    <div className={cn('border border-border/50 rounded-lg overflow-hidden bg-background', className)}>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
