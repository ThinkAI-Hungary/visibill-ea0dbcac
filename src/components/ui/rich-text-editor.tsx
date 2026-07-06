import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import { Bold, Italic, List, ListOrdered, Heading2, Undo, Redo, Pilcrow, ChevronDown, Variable } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface RichTextEditorProps {
  /** Initial content (plain text or HTML). Only used on mount. */
  initialContent: string;
  /** Called on every change with the current HTML. */
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Optional list of variable tokens the user can insert (e.g. "[Cégnév]") */
  variables?: { key: string; label: string }[];
}

function VariableDropdown({ editor, variables }: { editor: any; variables: { key: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!variables || variables.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 px-1.5 py-1.5 rounded-md transition-colors text-muted-foreground hover:bg-muted hover:text-foreground',
          open && 'bg-primary/15 text-primary'
        )}
        title="Változó beszúrása"
      >
        <Variable className="w-3.5 h-3.5" />
        <ChevronDown className="w-2.5 h-2.5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-h-[240px] overflow-y-auto">
          <p className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Változók beszúrása</p>
          {variables.map((v) => (
            <button
              key={v.key}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-2"
              onClick={() => {
                editor.chain().focus().insertContent(v.key).run();
                setOpen(false);
              }}
            >
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px]">{v.key}</span>
              <span className="text-muted-foreground">{v.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuBar({ editor, variables }: { editor: any; variables?: { key: string; label: string }[] }) {
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

      {/* B7: Variable insertion dropdown */}
      {variables && variables.length > 0 && (
        <>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <VariableDropdown editor={editor} variables={variables} />
        </>
      )}
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
 * - `variables` optionally adds a variable insertion dropdown to the toolbar.
 */
export function RichTextEditor({ initialContent, onChange, placeholder, className, variables }: RichTextEditorProps) {
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
      <MenuBar editor={editor} variables={variables} />
      <EditorContent editor={editor} />
    </div>
  );
}
