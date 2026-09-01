import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Code,
  Undo,
  Redo,
  Pilcrow,
  ChevronDown,
  Variable,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

export interface RichTextEditorProps {
  /** Initial content (plain text or HTML). Only read on mount or when key changes. */
  initialContent?: string;
  /** Called on every change with the current HTML. */
  onChange: (html: string) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Container CSS classes */
  className?: string;
  /** Editor content area specific CSS classes */
  editorClassName?: string;
  /** Minimum height for the editor area (e.g. '100px', '140px') */
  minHeight?: string;
  /** Disabled / readonly mode */
  disabled?: boolean;
  /** Optional list of variable tokens the user can insert (e.g. "[Cégnév]") */
  variables?: { key: string; label: string }[];
  /** Shortcut callback triggered on Ctrl+Enter / Cmd+Enter inside the editor */
  onSubmit?: () => void;
  /** Toolbar style variant */
  toolbarVariant?: 'full' | 'compact' | 'ticket';
  /** Hide toolbar completely */
  hideToolbar?: boolean;
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
          'flex items-center gap-1 px-1.5 py-1 rounded-md transition-colors text-xs text-muted-foreground hover:bg-muted hover:text-foreground',
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

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  tooltip,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none',
            active
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function MenuBar({
  editor,
  variables,
  disabled,
  toolbarVariant = 'ticket',
}: {
  editor: any;
  variables?: { key: string; label: string }[];
  disabled?: boolean;
  toolbarVariant?: 'full' | 'compact' | 'ticket';
}) {
  if (!editor) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/40 bg-muted/20 flex-wrap select-none">
        {/* Inline Formatting */}
        <ToolbarButton
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          tooltip="Félkövér (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          tooltip="Dőlt (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          tooltip="Áthúzott"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-3.5 bg-border/60 mx-1" />

        {/* Headings / Blocks */}
        {toolbarVariant !== 'compact' && (
          <>
            <ToolbarButton
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive('heading', { level: 2 })}
              tooltip="Címsor 2"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </ToolbarButton>

            <ToolbarButton
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive('heading', { level: 3 })}
              tooltip="Alcím 3"
            >
              <Heading3 className="w-3.5 h-3.5" />
            </ToolbarButton>

            <ToolbarButton
              disabled={disabled}
              onClick={() => editor.chain().focus().setParagraph().run()}
              active={editor.isActive('paragraph')}
              tooltip="Bekezdés"
            >
              <Pilcrow className="w-3.5 h-3.5" />
            </ToolbarButton>

            <div className="w-px h-3.5 bg-border/60 mx-1" />
          </>
        )}

        {/* Lists */}
        <ToolbarButton
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          tooltip="Felsorolás"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          tooltip="Számozott lista"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-3.5 bg-border/60 mx-1" />

        {/* Quote & Code */}
        <ToolbarButton
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          tooltip="Idézet"
        >
          <Quote className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          tooltip="Kód"
        >
          <Code className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-3.5 bg-border/60 mx-1" />

        {/* History */}
        <ToolbarButton
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          tooltip="Visszavonás (Ctrl+Z)"
        >
          <Undo className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          tooltip="Újra (Ctrl+Y)"
        >
          <Redo className="w-3.5 h-3.5" />
        </ToolbarButton>

        {/* Variable dropdown */}
        {variables && variables.length > 0 && (
          <>
            <div className="w-px h-3.5 bg-border/60 mx-1" />
            <VariableDropdown editor={editor} variables={variables} />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function toHtml(text?: string): string {
  if (!text) return '<p></p>';
  if (text.startsWith('<')) return text;
  return `<p>${text.replace(/\n/g, '</p><p>')}</p>`;
}

/**
 * Standard Rich Text Editor built on TipTap.
 * 
 * - Supports rich formatting (bold, italic, strike, headings, lists, code, quotes, undo/redo).
 * - Keyboard shortcuts: Ctrl+B, Ctrl+I, Ctrl+Z, Ctrl+Enter (via `onSubmit`).
 * - Uncontrolled architecture: `initialContent` is only read on mount or key change.
 * - `onChange` emits the HTML string.
 */
export function RichTextEditor({
  initialContent = '',
  onChange,
  placeholder,
  className,
  editorClassName,
  minHeight = '100px',
  disabled = false,
  variables,
  onSubmit,
  toolbarVariant = 'ticket',
  hideToolbar = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Kezdj el gépelni...',
      }),
    ],
    content: toHtml(initialContent),
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2.5 text-sm leading-relaxed',
          '[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_blockquote]:border-l-primary/60 [&_blockquote]:bg-muted/20 [&_blockquote]:py-0.5 [&_blockquote]:px-2.5',
          editorClassName
        ),
        style: `min-height: ${minHeight};`,
      },
      handleKeyDown: (_, event) => {
        if (onSubmit && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
    },
  });

  // Sync editable status dynamically
  useEffect(() => {
    if (editor && editor.isEditable !== !disabled) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  return (
    <div
      className={cn(
        'border border-border/60 rounded-lg overflow-hidden bg-background transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20',
        disabled && 'opacity-60 bg-muted/20 cursor-not-allowed',
        className
      )}
    >
      {!hideToolbar && (
        <MenuBar
          editor={editor}
          variables={variables}
          disabled={disabled}
          toolbarVariant={toolbarVariant}
        />
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
