import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { TicketTimeline } from "./TicketTimeline";
import { ImageGalleryModal } from "./ImageGalleryModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bug,
  Lightbulb,
  Send,
  Loader2,
  Clock,
  Globe,
  Building2,
  User,
  MessageSquare,
  ArrowLeft,
  Link2,
  ImagePlus,
  X,
  Plus,
  FileText,
  Headset,
  HelpCircle,
} from "lucide-react";
import { uploadTicketImage } from "@/lib/upload-ticket-image";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { TicketPriorityBadge } from "./TicketPriorityBadge";
import {
  useTicketDetail,
  useAddComment,
  useUpdateTicketStatus,
  useMarkTicketRead,
  useIsSupportAdmin,
  useTicketEvents,
  type TicketStatus,
  type TicketPriority,
  useUpdateTicketPriority,
  useUpdateTicketAssignee,
  useSupportAgents,
} from "@/hooks/useTickets";
import { useScopedBasePath } from "@/lib/navigation";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { hu } from "date-fns/locale";

interface TicketDetailViewProps {
  feedbackId: string;
  onBack?: () => void;
}

export function TicketDetailView({ feedbackId, onBack }: TicketDetailViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const eaisybillBasePath = useScopedBasePath();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, isLoading: isTicketLoading } = useTicketDetail(feedbackId);
  const { isLoading: isEventsLoading } = useTicketEvents(feedbackId);
  const { mutate: addComment, isPending: isCommenting } = useAddComment();
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateTicketStatus();
  const { mutate: markRead } = useMarkTicketRead();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsSupportAdmin();
  const { mutate: updatePriority } = useUpdateTicketPriority();
  const { mutate: updateAssignee } = useUpdateTicketAssignee();
  const { data: supportAgents = [] } = useSupportAgents();
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const openGallery = (images: string[], index: number) => {
    setGalleryImages(images);
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const openPreviewGallery = (index: number) => {
    const urls = commentFiles.map(file => URL.createObjectURL(file));
    openGallery(urls, index);
  };

  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Detect if we're in Accounty context
  const isAccounty = location.pathname.startsWith("/accounty");
  const ticketsBase = isAccounty ? "/accounty/tickets" : `${eaisybillBasePath}/tickets`;

  // Mark as read on mount
  useEffect(() => {
    if (feedbackId) markRead(feedbackId);
  }, [feedbackId, markRead]);

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [data?.comments?.length]);

  const handleSubmit = async () => {
    if (!comment.trim() || !feedbackId || !user) return;

    try {
      // Upload comment attachments to {ticketId}/{userId}/ path
      let attachmentUrls: string[] = [];
      if (commentFiles.length > 0) {
        const uploadPromises = commentFiles.map(file => uploadTicketImage(file, user.id, feedbackId));
        attachmentUrls = await Promise.all(uploadPromises);
      }

      addComment(
        { feedbackId, message: comment, attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined, isInternal },
        {
          onSuccess: () => {
            setComment("");
            setCommentFiles([]);
            setIsInternal(false);
            markRead(feedbackId);
          },
        }
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Kép feltöltési hiba", description: err?.message || "Ismeretlen hiba" });
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const namedFile = new File([file], `clipboard-image-${Date.now()}-${i}.png`, { type: file.type });
          files.push(namedFile);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      addCommentFiles(files);
    }
  };

  const addCommentFiles = (files: FileList | File[]) => {
    const MAX = 5;
    const ALLOWED = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const MAX_SIZE = 10 * 1024 * 1024;
    const validFiles = Array.from(files).filter(f => ALLOWED.includes(f.type) && f.size <= MAX_SIZE);
    setCommentFiles(prev => [...prev, ...validFiles].slice(0, MAX));
  };

  const removeCommentFile = (index: number) => {
    setCommentFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Navigate back: use browser history if available, otherwise go to /tickets
  const goBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/tickets");
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "yyyy. MMM d. HH:mm", { locale: hu });
  };

  // Collect ALL image URLs across ticket + comments for unified gallery
  const allImages = useMemo(() => {
    if (!data?.ticket) return [];
    const ticket = data.ticket;
    const comments = data.comments || [];
    const imgs: string[] = [];
    // Ticket attachments (images only)
    (ticket.attachments || []).forEach((url: string) => {
      if (/\.(jpe?g|png|gif|webp)$/i.test(url) || url.includes('/image/')) imgs.push(url);
    });
    // Comment attachments (images only)
    comments.forEach(c => {
      (c.attachments || []).forEach((url: string) => {
        if (/\.(jpe?g|png|gif|webp)$/i.test(url) || url.includes('/image/')) imgs.push(url);
      });
    });
    return imgs;
  }, [data?.ticket?.attachments, data?.comments]);

  // Preload images to avoid half-loaded image pop-in
  useEffect(() => {
    if (isTicketLoading || isEventsLoading || isAdminLoading || !data?.ticket) {
      setImagesLoaded(false);
      return;
    }

    if (allImages.length === 0) {
      setImagesLoaded(true);
      return;
    }

    let loadedCount = 0;
    const urls = allImages;
    let active = true;

    setImagesLoaded(false);

    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        if (!active) return;
        loadedCount++;
        if (loadedCount === urls.length) {
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        if (!active) return;
        loadedCount++;
        if (loadedCount === urls.length) {
          setImagesLoaded(true);
        }
      };
    });

    return () => {
      active = false;
    };
  }, [allImages, isTicketLoading, isEventsLoading, isAdminLoading, data?.ticket]);

  const isLoading = isTicketLoading || isEventsLoading || isAdminLoading || !imagesLoaded;

  if (isLoading || !data?.ticket) {
    return (
      <div className="space-y-6 p-2 sm:p-0 page-animate">
        {/* Back + ticket header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md shrink-0" />
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <Skeleton className="h-5 w-5 rounded-full shrink-0" />
            <Skeleton className="h-7 w-32 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: message + comments skeleton */}
          <div className="lg:col-span-2 space-y-4">
            {/* Original message card skeleton */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-[96%] rounded" />
                  <Skeleton className="h-4 w-[92%] rounded" />
                  <Skeleton className="h-4 w-[65%] rounded" />
                </div>
                {/* Attachments skeleton */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Skeleton className="h-[120px] w-[180px] rounded-md" />
                  <Skeleton className="h-[120px] w-[180px] rounded-md" />
                </div>
              </CardContent>
            </Card>

            {/* Comments header skeleton */}
            <div className="flex items-center gap-2 text-xs px-1">
              <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
              <Skeleton className="h-3.5 w-24 rounded" />
              <div className="flex-1">
                <Separator />
              </div>
            </div>

            {/* Comment card skeleton */}
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                </div>
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-[85%] rounded" />
                </div>
              </CardContent>
            </Card>

            {/* Comment input card skeleton */}
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                <Skeleton className="h-[80px] w-full rounded-md" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-9 w-20 rounded-md" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: ticket info sidebar skeleton */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-sm font-semibold">Részletek</h3>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-44 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-32 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-28 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-36 rounded" />
                  </div>
                </div>

                <Separator />

                {/* Típus */}
                <div className="space-y-2">
                  <Skeleton className="h-3 w-12 rounded" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-20 rounded" />
                  </div>
                </div>

                <Separator />

                {/* Felelős */}
                <div className="space-y-2">
                  <Skeleton className="h-3 w-12 rounded" />
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-24 rounded" />
                      <Skeleton className="h-3 w-20 rounded" />
                    </div>
                  </div>
                </div>

                <Separator />
                {/* Admin section skeleton */}
                <div className="space-y-2">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </CardContent>
            </Card>

            {/* Timeline skeleton */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-28 rounded" />
                </div>
                <div className="relative pl-6 space-y-6 pt-2">
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                  <div className="relative flex gap-3">
                    <Skeleton className="absolute -left-[27px] h-6 w-6 rounded-full bg-background border border-border" />
                    <div className="space-y-1.5 flex-1 pt-0.5 min-w-0">
                      <Skeleton className="h-3.5 w-40 rounded" />
                      <Skeleton className="h-3 w-20 rounded" />
                    </div>
                  </div>
                  <div className="relative flex gap-3">
                    <Skeleton className="absolute -left-[27px] h-6 w-6 rounded-full bg-background border border-border" />
                    <div className="space-y-1.5 flex-1 pt-0.5 min-w-0">
                      <Skeleton className="h-3.5 w-44 rounded" />
                      <Skeleton className="h-3 w-24 rounded" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const ticket = data.ticket;
  const comments = data.comments || [];

  const openGalleryForUrl = (url: string) => {
    const idx = allImages.indexOf(url);
    setGalleryImages(allImages);
    setGalleryIndex(idx >= 0 ? idx : 0);
    setGalleryOpen(true);
  };

  return (
    <div className="space-y-6 p-2 sm:p-0 page-animate">
      {/* Back + ticket header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0 h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {ticket.type === "bug" ? (
            <Bug className="h-5 w-5 text-red-500 shrink-0" />
          ) : (
            <Lightbulb className="h-5 w-5 text-amber-500 shrink-0" />
          )}
          <h1 className="text-xl font-bold tracking-tight">{ticket.ticket_number || "—"}</h1>
          <TicketPriorityBadge priority={ticket.priority} />
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: message + comments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original message */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {(ticket.user_name || ticket.user_email || "?")[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{ticket.user_name || ticket.user_email}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(ticket.created_at)}</p>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {ticket.message}
              </p>
              {/* Ticket attachments */}
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {ticket.attachments.map((url: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => openGalleryForUrl(url)}
                      className="relative group rounded-md overflow-hidden border border-border hover:border-primary/40 transition-colors cursor-zoom-in"
                    >
                      <img
                        src={url}
                        alt={`Csatolmány ${i + 1}`}
                        className="max-w-[300px] max-h-[200px] object-cover group-hover:opacity-80 transition-opacity"
                      />
                      {ticket.attachments!.length > 1 && (
                        <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                          {i + 1}/{ticket.attachments!.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <ImageGalleryModal
                images={galleryImages}
                initialIndex={galleryIndex}
                open={galleryOpen}
                onClose={() => setGalleryOpen(false)}
              />
            </CardContent>
          </Card>

          {/* Comments */}
          {comments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{comments.length} hozzászólás</span>
                <Separator className="flex-1" />
              </div>

              {comments.map((c) => (
                <Card
                  key={c.id}
                  className={
                    c.is_internal
                      ? "border-amber-500/30 bg-amber-500/[0.03]"
                      : c.is_admin
                      ? "border-primary/20 bg-primary/[0.02]"
                      : ""
                  }
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          c.is_internal
                            ? "bg-amber-500/15 text-amber-500"
                            : c.is_admin
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {(c.user_name || c.user_email || "?")[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {c.user_name || c.user_email}
                          </p>
                          {c.is_internal ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
                              Belső feljegyzés (kliens elől rejtve)
                            </span>
                          ) : c.is_admin ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              Support
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(c.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {c.message}
                    </p>
                    {/* Comment attachments */}
                    {c.attachments && c.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 pl-11">
                        {c.attachments.map((url: string, i: number) => (
                          <button
                            key={i}
                            onClick={() => openGalleryForUrl(url)}
                            className="relative group rounded-md overflow-hidden border border-border hover:border-primary/40 transition-colors cursor-zoom-in"
                          >
                            <img
                              src={url}
                              alt={`Csatolmány ${i + 1}`}
                              className="max-w-[250px] max-h-[160px] object-cover group-hover:opacity-80 transition-opacity"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />

          {/* Comment input */}
          {ticket.status === "resolved" ? (
            <Card className="border-dashed opacity-70">
              <CardContent className="py-5">
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                  <MessageSquare className="h-5 w-5" />
                  <p className="text-sm text-center">
                    Sajnos a már lezárt hibajegyhez további hozzászólás nem lehetséges.
                  </p>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={isUpdating}
                      onClick={() =>
                        updateStatus({
                          feedbackId: ticket.id,
                          status: "in_progress" as TicketStatus,
                        })
                      }
                    >
                      {isUpdating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Hibajegy újra megnyitása
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="space-y-2">
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files.length) addCommentFiles(e.dataTransfer.files); }}
                  >
                    <Textarea
                      placeholder="Hozzászólás... (Ctrl+Enter)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      className="min-h-[80px] max-h-[200px] resize-none"
                      rows={3}
                    />
                  </div>
                  {/* Comment attachment previews */}
                  {commentFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {commentFiles.map((file, i) => {
                        const isImage = file.type.startsWith("image/");
                        return (
                          <div key={i} className="relative group">
                            {isImage ? (
                              <button
                                type="button"
                                onClick={() => openPreviewGallery(i)}
                                className="h-16 w-16 rounded-md overflow-hidden border border-border hover:border-primary/40 transition-colors cursor-zoom-in"
                                title="Kép megtekintése"
                              >
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={file.name}
                                  className="h-full w-full object-cover group-hover:opacity-85 transition-opacity"
                                />
                              </button>
                            ) : (
                              <div className="h-16 w-16 rounded-md border border-border bg-muted flex flex-col items-center justify-center gap-0.5 px-1">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                                  {file.name.split('.').pop()?.toUpperCase()}
                                </span>
                              </div>
                            )}
                            <button
                              onClick={() => removeCommentFile(i)}
                              className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <input
                        ref={commentFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.csv,.xls,.xlsx"
                        multiple
                        className="hidden"
                        onChange={(e) => { if (e.target.files) addCommentFiles(e.target.files); e.target.value = ''; }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => commentFileInputRef.current?.click()}
                        disabled={commentFiles.length >= 5}
                        title="Fájl csatolása (kép, PDF, CSV)"
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                      {commentFiles.length > 0 && (
                        <span className="text-[11px] text-muted-foreground">{commentFiles.length}/5</span>
                      )}
                      {isAdmin && (
                        <label className="flex items-center gap-1.5 ml-2 text-xs text-amber-500 font-medium cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isInternal}
                            onChange={(e) => setIsInternal(e.target.checked)}
                            className="rounded border-amber-500/30 accent-amber-500"
                          />
                          Belső feljegyzés
                        </label>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={!comment.trim() || isCommenting}
                      className="gap-1.5"
                    >
                      {isCommenting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Küldés
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: ticket info sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-sm font-semibold">Részletek</h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="truncate">{ticket.user_email || ticket.user_name || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{ticket.company_name || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>{formatDate(ticket.created_at)}</span>
                </div>
                {ticket.page_url && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4 shrink-0" />
                    <a
                      href={ticket.page_url}
                      onClick={(e) => { e.preventDefault(); navigate(ticket.page_url!); }}
                      className="truncate text-xs text-primary hover:underline cursor-pointer"
                      title={ticket.page_url}
                    >
                      {ticket.page_url}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Link2 className="h-4 w-4 shrink-0" />
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/tickets/${ticket.id}`;
                      navigator.clipboard.writeText(url);
                      toast({ title: "Link másolva!", description: "A hibajegy közvetlen linkje a vágólapra került." });
                    }}
                    className="truncate text-xs text-primary hover:underline cursor-pointer text-left"
                    title="Kattints a link másolásához"
                  >
                    /tickets/{ticket.id.slice(0, 8)}…
                  </button>
                </div>
              </div>

              <Separator />

                <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Típus</p>
                <div className="flex items-center gap-2">
                  {ticket.type === "bug" ? (
                    <>
                      <Bug className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Hibajelentés</span>
                    </>
                  ) : ticket.type === "question" ? (
                    <>
                      <HelpCircle className="h-4 w-4 text-sky-500" />
                      <span className="text-sm">Kérdés</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">Visszajelzés</span>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              {/* Assigned support agent */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Felelős</p>
                {isAdmin ? (
                  <Select
                    value={ticket.assigned_to || "unassigned"}
                    onValueChange={(val) =>
                      updateAssignee({
                        feedbackId: ticket.id,
                        assignedTo: val === "unassigned" ? null : val,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Nincs hozzárendelve" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Nincs hozzárendelve</SelectItem>
                      {supportAgents.map((agent: any) => (
                        <SelectItem key={agent.user_id} value={agent.user_id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  ticket.assigned_to_name ? (
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <Headset className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{ticket.assigned_to_name}</p>
                        <p className="text-[11px] text-muted-foreground">ThinkAI Support</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                        <Headset className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Nincs hozzárendelve</p>
                        <p className="text-[11px] text-muted-foreground">ThinkAI Support</p>
                      </div>
                    </div>
                  )
                )}
              </div>

              {isAdmin && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Prioritás módosítása</p>
                    <Select
                      value={ticket.priority || "medium"}
                      onValueChange={(val) =>
                        updatePriority({
                          feedbackId: ticket.id,
                          priority: val as TicketPriority,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Alacsony</SelectItem>
                        <SelectItem value="medium">Közepes</SelectItem>
                        <SelectItem value="high">Magas</SelectItem>
                        <SelectItem value="critical">Kritikus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Admin status changer */}
              {isAdmin && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Státusz módosítása</p>
                    <Select
                      value={ticket.status}
                      onValueChange={(val) =>
                        updateStatus({
                          feedbackId: ticket.id,
                          status: val as TicketStatus,
                        })
                      }
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created">Új</SelectItem>
                        <SelectItem value="in_progress">Folyamatban</SelectItem>
                        <SelectItem value="resolved">Megoldva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <TicketTimeline feedbackId={feedbackId} />
        </div>
      </div>
    </div>
  );
}
