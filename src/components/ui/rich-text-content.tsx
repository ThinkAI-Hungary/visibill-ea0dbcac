import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface RichTextContentProps {
  content: string | null | undefined;
  className?: string;
  fallbackText?: string;
}

/**
 * Basic HTML sanitizer to prevent XSS without needing heavy external dependencies.
 * Removes <script>, <style>, <iframe>, <object>, <embed>, on* attributes, and javascript: links.
 */
function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^ >]+/gi, '')
    .replace(/href\s*=\s*(['"])javascript:.*?\1/gi, 'href="#"');
}

/**
 * Checks if a string contains meaningful HTML formatting tags.
 */
function isHtml(str: string): boolean {
  if (!str) return false;
  return /<(p|br|div|strong|b|em|i|u|s|strike|h[1-6]|ul|ol|li|blockquote|code|pre|a|table)\b[^>]*>/i.test(str);
}

/**
 * Component to render rich text / HTML content with standard Tailwind Typography (prose).
 * Automatically handles plain text legacy content with whitespace preservation.
 */
export const RichTextContent = React.memo(function RichTextContent({
  content,
  className,
  fallbackText = '—',
}: RichTextContentProps) {
  const trimmed = content?.trim() || '';
  const hasHtml = useMemo(() => isHtml(trimmed), [trimmed]);
  const cleanHtml = useMemo(() => (hasHtml ? sanitizeHtml(trimmed) : ''), [hasHtml, trimmed]);

  if (!trimmed) {
    return <span className="text-muted-foreground italic text-xs">{fallbackText}</span>;
  }

  if (!hasHtml) {
    return (
      <div className={cn('text-sm whitespace-pre-wrap leading-relaxed break-words', className)}>
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rich-text-content prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed break-words',
        '[&_p]:my-1.5',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2',
        '[&_li]:my-0.5',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-primary/70 [&_blockquote]:bg-muted/20 [&_blockquote]:py-1 [&_blockquote]:px-3 [&_blockquote]:my-2 [&_blockquote]:rounded-r-md [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
        '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-primary [&_code]:before:content-none [&_code]:after:content-none',
        '[&_pre]:bg-muted/80 [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:my-2',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80',
        className
      )}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
});
