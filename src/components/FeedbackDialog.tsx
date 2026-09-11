import React, { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadTicketImage, isAllowedTicketFile, MAX_FILE_SIZE } from "@/lib/upload-ticket-image";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { reportError } from '@/lib/errorReporter';
import {
  Bug,
  MessageSquareText,
  Send,
  Loader2,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ImagePlus,
  X,
  Paperclip,
  MonitorSmartphone,
  HelpCircle,
  Plus,
  Eye,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const MAX_ATTACHMENTS = 5;

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { t } = useTranslation(['common']);
  const { user } = useAuth();
  const { companies, selectedCompany } = useCompany();
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string>(selectedCompany?.id || "");
  const [service, setService] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [priority, setPriority] = useState<string>("medium");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Explicit form reset function
  const resetForm = useCallback(() => {
    setCompanyId(selectedCompany?.id || "");
    setService("");
    setType("");
    setPriority("medium");
    setMessage("");
    setAttachments([]);
    setSubmitted(false);
    setSubmitting(false);
    setIsDragOver(false);
    setEditorKey(k => k + 1);
  }, [selectedCompany?.id]);

  // Reset form whenever the dialog opens
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  // Handle open state changes from internal dialog controls (Esc, backdrop, close button)
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setSubmitted(false);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  // ── File handling ──
  const validateAndAddFiles = useCallback((files: FileList | File[]) => {
    const newFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!isAllowedTicketFile(file)) {
        toast({
          variant: "destructive",
          title: t('feedback.toasts.unsupported_type_title'),
          description: t('feedback.toasts.unsupported_type_desc', { name: file.name }),
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({
          variant: "destructive",
          title: t('feedback.toasts.file_too_large_title'),
          description: t('feedback.toasts.file_too_large_desc', { name: file.name }),
        });
        continue;
      }
      newFiles.push(file);
    }
    setAttachments(prev => {
      const total = [...prev, ...newFiles];
      if (total.length > MAX_ATTACHMENTS) {
        toast({
          variant: "destructive",
          title: t('feedback.toasts.too_many_attachments_title'),
          description: t('feedback.toasts.too_many_attachments_desc', { max: MAX_ATTACHMENTS }),
        });
        return total.slice(0, MAX_ATTACHMENTS);
      }
      return total;
    });
  }, [toast, t]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  }, [validateAndAddFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      e.target.value = ""; // reset to allow re-selecting same file
    }
  }, [validateAndAddFiles]);

  const selectedCompanyObj = companies.find((c) => c.id === companyId);
  const isTextNotEmpty = Boolean(message && message.replace(/<[^>]*>/g, '').trim().length > 0);
  const hasContent = isTextNotEmpty || attachments.length > 0;
  const canSubmit = Boolean(companyId && service && type && hasContent);

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;

    setSubmitting(true);
    try {
      // Pre-generate ticket ID for structured storage path
      const ticketId = crypto.randomUUID();

      // Upload attachments to {ticketId}/{userId}/ path
      let attachmentUrls: string[] = [];
      if (attachments.length > 0) {
        const uploadPromises = attachments.map(file => uploadTicketImage(file, user.id, ticketId));
        attachmentUrls = await Promise.all(uploadPromises);
      }

      const { error } = await supabase.from("feedback").insert({
        id: ticketId,
        user_id: user.id,
        company_id: companyId,
        company_name: selectedCompanyObj?.name || null,
        type,
        service,
        priority,
        message: message.trim(),
        user_email: user.email || null,
        user_name: user.user_metadata?.name || null,
        page_url: window.location.pathname,
        ...(attachmentUrls.length > 0 ? { attachments: attachmentUrls } : {}),
      });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: t('feedback.toasts.submit_success_title'),
        description: t('feedback.toasts.submit_success_desc'),
      });
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'FeedbackDialog', action: 'error', message: 'Feedback submit error:', error: err });
      const errorMsg = err?.message || err?.error_description || "Ismeretlen hiba";
      toast({
        variant: "destructive",
        title: t('feedback.toasts.error_title'),
        description: t('feedback.toasts.submit_error_desc', { error: errorMsg }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageSquareText className="h-5 w-5 text-primary" />
            {t('feedback.dialog_title')}
          </DialogTitle>
          <DialogDescription>
            {t('feedback.dialog_description')}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold">{t('feedback.success_title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('feedback.success_desc')}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t('feedback.close')}
              </Button>
              <Button onClick={resetForm} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t('feedback.new_feedback')}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <div className="space-y-5 py-2">
            {/* Top selectors in 2-column responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company selector */}
              <div className="space-y-2">
                <Label htmlFor="feedback-company" className="text-sm font-medium">
                  {t('feedback.company_label')}
                </Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger id="feedback-company">
                    <SelectValue placeholder={t('feedback.select_company')} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service selector */}
              <div className="space-y-2">
                <Label htmlFor="feedback-service" className="text-sm font-medium">
                  {t('feedback.service_label')}
                </Label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger id="feedback-service">
                    <SelectValue placeholder={t('feedback.select_service')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eaisybill">
                      <span className="flex items-center gap-2">
                        <span className="text-sm">
                          <span className="font-medium text-foreground/80">e</span>
                          <span className="font-bold text-primary">ai</span>
                          <span className="font-medium text-foreground/80">sy</span>
                          <span className="font-medium text-primary">bill</span>
                        </span>
                      </span>
                    </SelectItem>
                    <SelectItem value="accounty">
                      <span className="flex items-center gap-2">
                        <span className="text-sm">
                          <span className="font-medium text-foreground/80">e</span>
                          <span className="font-bold text-primary">ai</span>
                          <span className="font-medium text-foreground/80">sy</span>
                          <span className="font-medium text-primary">books</span>
                        </span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Type selector */}
              <div className="space-y-2">
                <Label htmlFor="feedback-type" className="text-sm font-medium">
                  {t('feedback.type_label')}
                </Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="feedback-type">
                    <SelectValue placeholder={t('feedback.select_type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">
                      <span className="flex items-center gap-2">
                        <Bug className="h-4 w-4 text-red-500" />
                        {t('feedback.type_bug')}
                      </span>
                    </SelectItem>
                    <SelectItem value="feedback">
                      <span className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        {t('feedback.type_feedback')}
                      </span>
                    </SelectItem>
                    <SelectItem value="question">
                      <span className="flex items-center gap-2">
                        <HelpCircle className="h-4 w-4 text-sky-500" />
                        {t('feedback.type_question')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority selector */}
              <div className="space-y-2">
                <Label htmlFor="feedback-priority" className="text-sm font-medium">
                  {t('feedback.priority_label')}
                </Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="feedback-priority">
                    <SelectValue placeholder={t('feedback.select_priority')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('feedback.priority_low')}</SelectItem>
                    <SelectItem value="medium">{t('feedback.priority_medium')}</SelectItem>
                    <SelectItem value="high">{t('feedback.priority_high')}</SelectItem>
                    <SelectItem value="critical">{t('feedback.priority_critical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {t('feedback.message_label')}
                </Label>
              </div>
              <RichTextEditor
                key={editorKey}
                initialContent=""
                onChange={(html) => setMessage(html)}
                placeholder={
                  type === "bug"
                    ? t('feedback.placeholder_bug')
                    : t('feedback.placeholder_feedback')
                }
                minHeight="120px"
                toolbarVariant="ticket"
              />
            </div>

            {/* Attachments drop zone */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  {t('feedback.attachments_label')}
                  <span className="text-xs text-muted-foreground font-normal">{t('feedback.optional')}</span>
                </Label>
                {attachments.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {attachments.length}/{MAX_ATTACHMENTS}
                  </span>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.csv,.xls,.xlsx,.xml,text/xml,application/xml"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />

              {/* Drop zone */}
              {attachments.length < MAX_ATTACHMENTS && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-all
                    ${isDragOver
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
                    }
                  `}
                >
                  <ImagePlus className={`h-6 w-6 transition-colors ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-center">
                    <p className={`text-sm font-medium transition-colors ${isDragOver ? "text-primary" : "text-muted-foreground"}`}>
                      {isDragOver ? t('feedback.drag_drop_active') : t('feedback.drag_drop_idle')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('feedback.or_browse')} <span className="text-primary underline underline-offset-2">{t('feedback.browse_link')}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      {t('feedback.supported_formats')}
                    </p>
                  </div>
                </div>
              )}

              {/* Attachment previews */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-1">
                  {attachments.map((file, index) => {
                    const isImage = file.type.startsWith("image/");
                    const fileUrl = URL.createObjectURL(file);
                    return (
                      <div
                        key={`${file.name}-${index}`}
                        className="group relative flex flex-col gap-1.5 w-32 sm:w-36 p-2 rounded-xl border border-border/80 bg-card/90 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                      >
                        {isImage ? (
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted/40 border border-border/30">
                            <img
                              src={fileUrl}
                              alt={file.name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            {/* Floating Action Toolbar */}
                            <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-neutral-900/85 backdrop-blur-sm border border-neutral-700/60 rounded-md p-0.5 shadow-md opacity-90 group-hover:opacity-100 transition-opacity z-10">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(fileUrl, '_blank');
                                    }}
                                    className="h-6 w-6 rounded flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {t('feedback.view_new_tab')}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeAttachment(index);
                                    }}
                                    className="h-6 w-6 rounded flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {t('feedback.delete_attachment')}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        ) : (
                          <div className="relative w-full aspect-square rounded-lg bg-muted/60 border border-border/30 flex flex-col items-center justify-center gap-1 p-2">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <Paperclip className="h-5 w-5" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded bg-background border border-border/60">
                              {file.name.split('.').pop()?.toUpperCase()}
                            </span>
                            {/* Floating Action Toolbar */}
                            <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-neutral-900/85 backdrop-blur-sm border border-neutral-700/60 rounded-md p-0.5 shadow-md z-10">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeAttachment(index);
                                    }}
                                    className="h-6 w-6 rounded flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {t('feedback.delete_attachment')}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        )}
                        {/* Filename caption */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p
                              className="text-[11px] font-mono text-muted-foreground truncate px-0.5 cursor-default"
                            >
                              {file.name}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {file.name}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Guidelines footer */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Info className="h-4 w-4" />
                {t('feedback.guidelines_title')}
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground">
                {type === "bug" ? (
                  <>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-red-400 shrink-0" />
                      <span>
                        <strong>{t('feedback.guidelines_bug_problem_title')}</strong> {t('feedback.guidelines_bug_problem_desc')}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-red-400 shrink-0" />
                      <span>
                        <strong>{t('feedback.guidelines_bug_steps_title')}</strong> {t('feedback.guidelines_bug_steps_desc')}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-red-400 shrink-0" />
                      <span>
                        <strong>{t('feedback.guidelines_bug_env_title')}</strong> {t('feedback.guidelines_bug_env_desc')}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>{t('feedback.guidelines_idea_feature_title')}</strong> {t('feedback.guidelines_idea_feature_desc')}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>{t('feedback.guidelines_idea_usecase_title')}</strong> {t('feedback.guidelines_idea_usecase_desc')}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>{t('feedback.guidelines_idea_priority_title')}</strong> {t('feedback.guidelines_idea_priority_desc')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Submit */}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                {t('feedback.cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t('feedback.send')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
