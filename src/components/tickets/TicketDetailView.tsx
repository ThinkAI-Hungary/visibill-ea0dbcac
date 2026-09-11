import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { TicketTimeline } from "./TicketTimeline";
import { ImageGalleryModal } from "./ImageGalleryModal";
import { TicketNotFoundView } from "./TicketNotFoundView";
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
  Trash2,
  ShieldAlert,
  Paperclip,
  Eye,
  CircleDot,
  UserCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { uploadTicketImage, isAllowedTicketFile } from "@/lib/upload-ticket-image";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { TicketPriorityBadge } from "./TicketPriorityBadge";
import { ThinkAiBadge, ThinkAiIcon } from "./ThinkAiBadge";
import { TicketResolutionBanner } from "./TicketResolutionBanner";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextContent } from "@/components/ui/rich-text-content";
import {
  useTicketDetail,
  useAddComment,
  useUpdateTicketStatus,
  useMarkTicketRead,
  useIsSupportAdmin,
  useIsManagementRole,
  useTicketEvents,
  type TicketStatus,
  type TicketPriority,
  useUpdateTicketPriority,
  useUpdateTicketAssignee,
  useSupportAgents,
  useDeleteTicket,
  useUpdateTicketAttachments,
  useRequestTicketResolution,
} from "@/hooks/useTickets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useScopedBasePath } from "@/lib/navigation";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { hu } from "date-fns/locale";

interface TicketDetailViewProps {
  feedbackId: string;
  onBack?: () => void;
  onDeleted?: () => void;
}

export function TicketDetailView({ feedbackId, onBack, onDeleted }: TicketDetailViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const eaisybillBasePath = useScopedBasePath();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, isLoading: isTicketLoading, isError: isTicketError } = useTicketDetail(feedbackId);
  const ticket = data?.ticket;
  const comments = data?.comments || [];
  const { data: ticketEvents = [], isLoading: isEventsLoading } = useTicketEvents(feedbackId);
  const { mutate: addComment, isPending: isCommenting } = useAddComment();
  const { mutate: requestResolution, isPending: isRequestingResolution } = useRequestTicketResolution();
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateTicketStatus();
  const { mutate: markRead } = useMarkTicketRead();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsSupportAdmin();
  const { mutate: updatePriority } = useUpdateTicketPriority();
  const { mutate: updateAssignee } = useUpdateTicketAssignee();
  const { data: supportAgents = [] } = useSupportAgents();
  const { mutateAsync: updateTicketAttachments, isPending: isUpdatingAttachments } = useUpdateTicketAttachments();
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [requestResolutionChecked, setRequestResolutionChecked] = useState(false);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploadingTicketAttachment, setIsUploadingTicketAttachment] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const { data: isManagement } = useIsManagementRole();
  const { mutateAsync: deleteTicket, isPending: isDeleting } = useDeleteTicket();

  const isImageUrl = (url: string) => {
    if (!url) return false;
    return /\.(jpe?g|png|gif|webp)$/i.test(url) || url.includes('/image/');
  };

  const getFileName = (url: string) => {
    try {
      const decoded = decodeURIComponent(url);
      const parts = decoded.split('/');
      const lastPart = parts[parts.length - 1] || 'fájl';
      return lastPart.split('?')[0];
    } catch {
      return 'fájl';
    }
  };

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
  const ticketAttachmentInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Detect if we're in Accounty context
  const isAccounty = location.pathname.startsWith("/eaisybooks");
  const isStandalone = location.pathname.startsWith("/tickets");
  const ticketsBase = isAccounty 
    ? "/eaisybooks/tickets" 
    : (isStandalone ? "/tickets" : `${eaisybillBasePath}/tickets`);

  // Mark as read on mount
  useEffect(() => {
    if (feedbackId) markRead(feedbackId);
  }, [feedbackId, markRead]);

  // Track whether to auto-scroll (only after user sends a comment)
  const shouldScrollRef = useRef(false);

  // Auto-scroll to bottom only when user sends a new comment
  useEffect(() => {
    if (shouldScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      shouldScrollRef.current = false;
    }
  }, [data?.comments?.length]);

  const handleSubmit = async () => {
    const isTextEmpty = !comment || comment.replace(/<[^>]*>/g, '').trim() === '';
    const hasFiles = commentFiles.length > 0;
    if ((isTextEmpty && !hasFiles && !requestResolutionChecked) || !feedbackId || !user) return;

    try {
      // Upload comment attachments to {ticketId}/{userId}/ path
      let attachmentUrls: string[] = [];
      if (hasFiles) {
        const uploadPromises = commentFiles.map(file => uploadTicketImage(file, user.id, feedbackId));
        attachmentUrls = await Promise.all(uploadPromises);
      }

      if (requestResolutionChecked) {
        requestResolution(
          {
            feedbackId,
            comment: isTextEmpty ? undefined : comment,
            attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined,
          },
          {
            onSuccess: () => {
              setComment("");
              setCommentFiles([]);
              setIsInternal(false);
              setRequestResolutionChecked(false);
              setEditorKey(k => k + 1);
              markRead(feedbackId);
              shouldScrollRef.current = true;
              toast({
                title: isTextEmpty && !hasFiles ? "Megerősítés-kérés elküldve" : "Válasz és megerősítés-kérés elküldve",
                description: isTextEmpty && !hasFiles
                  ? "A hibajegy állapota visszaigazolásra váróra váltott."
                  : "A felhasználó értesítést kapott a javasolt megoldásról.",
              });
            },
            onError: (err: any) => {
              toast({
                variant: "destructive",
                title: "Hiba a küldéskor",
                description: err?.message || "Nem sikerült elküldeni a kérést.",
              });
            },
          }
        );
      } else {
        addComment(
          { feedbackId, message: comment, attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined, isInternal },
          {
            onSuccess: () => {
              setComment("");
              setCommentFiles([]);
              setIsInternal(false);
              setRequestResolutionChecked(false);
              setEditorKey(k => k + 1);
              markRead(feedbackId);
              shouldScrollRef.current = true;
            },
          }
        );
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Kép feltöltési hiba", description: err?.message || "Ismeretlen hiba" });
    }
  };

  const handleAddTicketAttachments = async (files: FileList | File[]) => {
    if (!ticket || !user) return;
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploadingTicketAttachment(true);
    try {
      const uploadPromises = fileArray.map(file => uploadTicketImage(file, user.id, ticket.id));
      const newUrls = await Promise.all(uploadPromises);
      const existing = ticket.attachments || [];
      await updateTicketAttachments({
        feedbackId: ticket.id,
        attachments: [...existing, ...newUrls],
      });
      toast({
        title: "Csatolmány hozzáadva",
        description: `${newUrls.length} fájl sikeresen csatolva a hibajegyhez.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Feltöltési hiba",
        description: err?.message || "Nem sikerült feltölteni a csatolmányt.",
      });
    } finally {
      setIsUploadingTicketAttachment(false);
    }
  };

  const handleRemoveTicketAttachment = async (indexToRemove: number) => {
    if (!ticket) return;
    const updated = (ticket.attachments || []).filter((_, i) => i !== indexToRemove);
    try {
      await updateTicketAttachments({
        feedbackId: ticket.id,
        attachments: updated,
      });
      toast({
        title: "Csatolmány eltávolítva",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Hiba az eltávolításkor",
        description: err?.message,
      });
    }
  };

  const addCommentFiles = (files: FileList | File[]) => {
    const MAX = 5;
    const MAX_SIZE = 10 * 1024 * 1024;
    const validFiles = Array.from(files).filter(f => isAllowedTicketFile(f) && f.size <= MAX_SIZE);
    setCommentFiles(prev => [...prev, ...validFiles].slice(0, MAX));
  };

  const removeCommentFile = (index: number) => {
    setCommentFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Navigate back: use onBack if provided, or navigate to ticketsBase
  const goBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(ticketsBase);
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

  const isTicketNotFound = !isTicketLoading && (!data?.ticket || isTicketError);
  const isLoading = isTicketLoading || (!isTicketNotFound && (!imagesLoaded || isAdminLoading || isEventsLoading));

  if (isTicketLoading || (isLoading && !isTicketNotFound)) {
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Fő tartalom skeleton */}
          <div className="lg:col-span-7 xl:col-span-8 2xl:col-span-8 space-y-4 min-w-0">
            {/* Original message card skeleton */}
            <Card className="rounded-none shadow-none">
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
            <Card className="rounded-none shadow-none">
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
            <Card className="rounded-none shadow-none">
              <CardContent className="pt-4 pb-4 space-y-3">
                <Skeleton className="h-[80px] w-full rounded-md" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-9 w-20 rounded-md" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Oldalsáv skeleton (Részletek + Jegy története) */}
          <div className="lg:col-span-5 xl:col-span-4 2xl:col-span-4 space-y-4 min-w-0">
            <Card className="rounded-none shadow-none">
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
            <Card className="rounded-none shadow-none">
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

  if (isTicketNotFound || !ticket) {
    return <TicketNotFoundView onBack={goBack} ticketsBase={ticketsBase} />;
  }

  // Declared at top

  const openGalleryForUrl = (url: string) => {
    const idx = allImages.indexOf(url);
    setGalleryImages(allImages);
    setGalleryIndex(idx >= 0 ? idx : 0);
    setGalleryOpen(true);
  };

  const staffEvent = ticketEvents.find(
    (e) =>
      e.event_type === "created" &&
      Boolean(e.metadata?.created_by_staff || e.metadata?.created_on_behalf)
  );
  const isStaffInitiated = Boolean(
    ticket.created_by_is_staff ||
    (ticket.created_by && ticket.created_by !== ticket.user_id) ||
    staffEvent ||
    (ticket.service === "management" && ticket.assigned_to)
  );
  const initialAuthorName = isStaffInitiated
    ? (ticket.assigned_to_name || ticket.created_by_name || staffEvent?.actor_name || "Support munkatárs")
    : (ticket.user_name || ticket.user_email);

  return (
    <TooltipProvider delayDuration={200}>
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
            <TicketStatusBadge status={ticket.status} waitingForConfirmation={ticket.waiting_for_user_confirmation} />
          </div>
          {/* Delete button — management only */}
          {isAdmin && isManagement && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Jegy törlése
            </Button>
          )}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hibajegy végleges törlése</AlertDialogTitle>
              <AlertDialogDescription>
                Biztosan törölni szeretnéd a <strong>{ticket.ticket_number}</strong> hibajegyet?
                Ez a művelet nem visszavonható — az összes hozzászólás, csatolmány és előzmény is törlődik.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Mégse</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await deleteTicket(feedbackId);
                    toast({
                      title: "Hibajegy törölve",
                      description: `${ticket.ticket_number} sikeresen törölve.`,
                    });
                    setShowDeleteConfirm(false);
                    if (onDeleted) {
                      onDeleted();
                    } else {
                      goBack();
                    }
                  } catch (err: any) {
                    toast({
                      variant: "destructive",
                      title: "Törlési hiba",
                      description: err?.message || "Nem sikerült törölni a hibajegyet.",
                    });
                  }
                }}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                Véglegesen törlöm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Fő tartalom (üzenet + csatolmányok + hozzászólások + válaszíró) */}
          <div className="lg:col-span-7 xl:col-span-8 2xl:col-span-8 space-y-4 min-w-0">
            {/* Original message */}
            <Card className={`rounded-none shadow-none ${isStaffInitiated ? "border-primary/20 bg-primary/[0.02]" : ""}`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isStaffInitiated ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {(initialAuthorName || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{initialAuthorName}</p>
                      {isStaffInitiated && (
                        <ThinkAiBadge size="sm" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ticket.created_at)}
                    </p>
                  </div>
                </div>
                <RichTextContent content={ticket.message} />

                {/* Ticket attachments */}
                <div className="mt-4 pt-3 border-t border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5" />
                      Csatolmányok ({ticket.attachments?.length || 0})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={ticketAttachmentInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.csv,.xls,.xlsx,.xml,text/xml,application/xml"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleAddTicketAttachments(e.target.files);
                          }
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 hover:bg-muted"
                        onClick={() => ticketAttachmentInputRef.current?.click()}
                        disabled={isUploadingTicketAttachment || isUpdatingAttachments}
                      >
                        {isUploadingTicketAttachment || isUpdatingAttachments ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        Csatolmány hozzáadása
                      </Button>
                    </div>
                  </div>

                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {ticket.attachments.map((url: string, i: number) => {
                        const isImg = isImageUrl(url);
                        const fileName = getFileName(url);
                        return isImg ? (
                          <div key={i} className="relative group">
                            <button
                              type="button"
                              onClick={() => openGalleryForUrl(url)}
                              className="relative block rounded-md overflow-hidden border border-border hover:border-primary/40 transition-colors cursor-zoom-in"
                            >
                              <img
                                src={url}
                                alt={`Csatolmány ${i + 1}`}
                                className="max-w-[260px] max-h-[160px] object-cover group-hover:opacity-80 transition-opacity"
                              />
                              {ticket.attachments!.length > 1 && (
                                <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                                  {i + 1}/{ticket.attachments!.length}
                                </span>
                              )}
                            </button>
                            {(isAdmin || user?.id === ticket.user_id) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTicketAttachment(i)}
                                    className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Csatolmány törlése
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        ) : (
                          <div key={i} className="relative group flex items-center gap-2 p-2 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors">
                            <FileText className="h-5 w-5 text-primary shrink-0" />
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-foreground hover:text-primary truncate max-w-[200px]"
                            >
                              {fileName}
                            </a>
                            {(isAdmin || user?.id === ticket.user_id) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTicketAttachment(i)}
                                    className="h-5 w-5 text-muted-foreground hover:text-destructive transition-colors ml-1"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Csatolmány törlése
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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

                {comments.map((c) => {
                  const isResolutionConfirmation = Boolean(
                    c.message && (
                      c.message.includes('megerősítette a megoldást') ||
                      c.message.includes('megoldás megerősítve') ||
                      c.message.includes('A javasolt megoldás megerősítve') ||
                      c.message.includes('megoldás visszaigazolva') ||
                      c.message.includes('Az ügyfél megerősítette') ||
                      c.message.includes('probléma megoldódott')
                    )
                  );

                  if (isResolutionConfirmation) {
                    return (
                      <div
                        key={c.id}
                        className="rounded-none border border-emerald-500/30 bg-emerald-500/[0.04] p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 my-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-6 w-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <span className="text-xs font-medium text-emerald-950 dark:text-emerald-200">
                            Az ügyfél megerősítette: a probléma megoldódott. A hibajegy automatikusan lezárásra került.
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                          {formatDate(c.created_at)}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <Card
                      key={c.id}
                      className={`rounded-none shadow-none ${
                        c.is_internal
                          ? "border-amber-500/30 bg-amber-500/[0.03]"
                          : c.is_admin
                          ? "border-primary/20 bg-primary/[0.02]"
                          : ""
                      }`}
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
                                <ThinkAiBadge size="xs" />
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(c.created_at)}
                            </p>
                          </div>
                        </div>
                        <RichTextContent content={c.message} />
                      {/* Comment attachments */}
                      {c.attachments && c.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 pl-11">
                          {c.attachments.map((url: string, i: number) => {
                            const isImg = isImageUrl(url);
                            const fileName = getFileName(url);
                            return isImg ? (
                              <button
                                key={i}
                                type="button"
                                onClick={() => openGalleryForUrl(url)}
                                className="relative group rounded-md overflow-hidden border border-border hover:border-primary/40 transition-colors cursor-zoom-in"
                              >
                                <img
                                  src={url}
                                  alt={`Csatolmány ${i + 1}`}
                                  className="max-w-[250px] max-h-[160px] object-cover group-hover:opacity-80 transition-opacity"
                                />
                              </button>
                            ) : (
                              <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors">
                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-medium text-foreground hover:text-primary truncate max-w-[180px]"
                                    >
                                      {fileName}
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {fileName}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={bottomRef} />

            {/* Resolution confirmation banner (if waiting for user confirmation) */}
            <TicketResolutionBanner
              ticketId={ticket.id}
              isReporter={user?.id === ticket.user_id}
              isAdmin={Boolean(isAdmin || isManagement)}
              waitingForConfirmation={Boolean(ticket.waiting_for_user_confirmation)}
              resolutionRequestedAt={ticket.resolution_requested_at}
              onSuccess={() => {
                markRead(ticket.id);
              }}
            />

            {/* Comment input */}
            {ticket.status === "resolved" ? (
              <Card className="border-dashed opacity-70 rounded-none shadow-none">
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
              <Card className="rounded-none shadow-none">
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-3">
                    {ticket && !ticket.assigned_to && (
                      <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-none text-xs font-medium leading-relaxed">
                        <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                        <div>
                          A hozzászóláshoz a hibajegynek rendelkeznie kell felelőssel.
                          {isAdmin ? " Kérjük, jelöljön ki egy felelőst a jobb oldali panelen." : " Kérjük, várja meg, amíg egy support munkatárs elvállalja a hibajegyet."}
                        </div>
                      </div>
                    )}
                    <div
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (ticket?.assigned_to && e.dataTransfer.files.length) addCommentFiles(e.dataTransfer.files); }}
                    >
                      <RichTextEditor
                        key={editorKey}
                        placeholder={ticket?.assigned_to ? "Hozzászólás... (Ctrl+Enter a küldéshez)" : "A hozzászólás zárolva van, amíg nincs felelőse a jegynek."}
                        initialContent=""
                        onChange={(html) => setComment(html)}
                        onSubmit={handleSubmit}
                        disabled={!ticket?.assigned_to}
                        minHeight="80px"
                        toolbarVariant="ticket"
                      />
                    </div>
                    {/* Comment attachment previews */}
                    {commentFiles.length > 0 && (
                      <div className="flex flex-wrap gap-3 pt-1">
                        {commentFiles.map((file, i) => {
                          const isImage = file.type.startsWith("image/");
                          return (
                            <div
                              key={i}
                              className="group relative flex flex-col gap-1.5 w-32 sm:w-36 p-2 rounded-xl border border-border/80 bg-card/90 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                            >
                              {isImage ? (
                                <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted/40 border border-border/30">
                                  <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                  {/* Floating Action Toolbar */}
                                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-neutral-900/85 backdrop-blur-sm border border-neutral-700/60 rounded-md p-0.5 shadow-md opacity-90 group-hover:opacity-100 transition-opacity z-10">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={() => openPreviewGallery(i)}
                                          className="h-6 w-6 rounded flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        Megtekintés
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={() => removeCommentFile(i)}
                                          className="h-6 w-6 rounded flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        Törlés
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative w-full aspect-square rounded-lg bg-muted/60 border border-border/30 flex flex-col items-center justify-center gap-1 p-2">
                                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <FileText className="h-5 w-5" />
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
                                          onClick={() => removeCommentFile(i)}
                                          className="h-6 w-6 rounded flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        Törlés
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <input
                          ref={commentFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.csv,.xls,.xlsx,.xml,text/xml,application/xml"
                          multiple
                          className="hidden"
                          onChange={(e) => { if (e.target.files) addCommentFiles(e.target.files); e.target.value = ''; }}
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => commentFileInputRef.current?.click()}
                              disabled={!ticket?.assigned_to || commentFiles.length >= 5}
                            >
                              <Plus className="h-5 w-5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Fájl csatolása (kép, PDF, CSV, Excel, XML)
                          </TooltipContent>
                        </Tooltip>
                        {commentFiles.length > 0 && (
                          <span className="text-[11px] text-muted-foreground">{commentFiles.length}/5</span>
                        )}
                        {isAdmin && (
                          <div className="flex items-center gap-3 ml-2">
                            <label className={`flex items-center gap-1.5 text-xs text-amber-500 font-medium select-none ${ticket?.assigned_to ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                              <input
                                type="checkbox"
                                checked={isInternal}
                                onChange={(e) => {
                                  setIsInternal(e.target.checked);
                                  if (e.target.checked) setRequestResolutionChecked(false);
                                }}
                                className="rounded border-amber-500/30 accent-amber-500"
                                disabled={!ticket?.assigned_to}
                              />
                              Belső feljegyzés
                            </label>

                            {!ticket?.waiting_for_user_confirmation && (
                              <label className={`flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium select-none ${ticket?.assigned_to ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                <input
                                  type="checkbox"
                                  checked={requestResolutionChecked}
                                  onChange={(e) => {
                                    setRequestResolutionChecked(e.target.checked);
                                    if (e.target.checked) setIsInternal(false);
                                  }}
                                  className="rounded border-emerald-500/30 accent-emerald-500"
                                  disabled={!ticket?.assigned_to || isInternal}
                                />
                                Megoldás visszaigazolás kérése
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={
                          !ticket?.assigned_to ||
                          (!requestResolutionChecked && ((!comment || comment.replace(/<[^>]*>/g, '').trim() === '') && commentFiles.length === 0)) ||
                          isCommenting ||
                          isRequestingResolution
                        }
                        className={`gap-1.5 ${requestResolutionChecked ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                      >
                        {isCommenting || isRequestingResolution ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : requestResolutionChecked ? (
                          <Sparkles className="h-3.5 w-3.5" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {requestResolutionChecked ? "Küldés és megerősítés kérése" : "Küldés"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Oldalsáv: Részletek + Jegy története */}
          <div className="lg:col-span-5 xl:col-span-4 2xl:col-span-4 space-y-4 min-w-0 xl:sticky xl:top-[3.75rem]">
            <Card className="rounded-none shadow-none">
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-sm font-semibold">Részletek</h3>

                {/* Status Banner — Layout 3 */}
                {(() => {
                  const bannerConfig = {
                    created: {
                      label: "Nyitott",
                      title: "Jegy állapota: Nyitott",
                      sub: "Várakozik a feldolgozásra",
                      icon: CircleDot,
                      bgClass: "bg-gradient-to-br from-sky-500/[0.08] to-cyan-500/[0.04] border-sky-500/25",
                      iconBubbleClass: "bg-sky-500 text-white shadow-sm shadow-sky-500/20",
                      titleClass: "text-sky-900 dark:text-sky-200",
                      subClass: "text-sky-600 dark:text-sky-400",
                      triggerClass: "border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10",
                    },
                    assigned: {
                      label: "Hozzárendelt",
                      title: "Jegy állapota: Hozzárendelt",
                      sub: "Felelős munkatárs kijelölve",
                      icon: UserCheck,
                      bgClass: "bg-gradient-to-br from-blue-600/[0.12] to-indigo-600/[0.05] border-blue-500/30",
                      iconBubbleClass: "bg-blue-600 text-white shadow-sm shadow-blue-600/20",
                      titleClass: "text-blue-900 dark:text-blue-200",
                      subClass: "text-blue-600 dark:text-blue-400",
                      triggerClass: "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-600/15",
                    },
                    in_progress: {
                      label: "Folyamatban",
                      title: "Jegy állapota: Folyamatban",
                      sub: "A support csapat dolgozik rajta",
                      icon: Loader2,
                      bgClass: "bg-gradient-to-br from-teal-500/[0.08] to-emerald-500/[0.04] border-teal-500/25",
                      iconBubbleClass: "bg-teal-500 text-white shadow-sm shadow-teal-500/20",
                      titleClass: "text-teal-900 dark:text-teal-200",
                      subClass: "text-teal-600 dark:text-teal-400",
                      triggerClass: "border-teal-500/30 text-teal-600 dark:text-teal-400 bg-teal-500/10",
                    },
                    resolved: {
                      label: "Megoldva",
                      title: "Jegy állapota: Megoldva",
                      sub: "A hibajegy lezárásra került",
                      icon: CheckCircle2,
                      bgClass: "bg-gradient-to-br from-emerald-500/[0.08] to-teal-500/[0.04] border-emerald-500/25",
                      iconBubbleClass: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20",
                      titleClass: "text-emerald-900 dark:text-emerald-200",
                      subClass: "text-emerald-600 dark:text-emerald-400",
                      triggerClass: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                    },
                  }[ticket.status as TicketStatus] || {
                    label: "Nyitott",
                    title: "Jegy állapota: Nyitott",
                    sub: "Várakozik a feldolgozásra",
                    icon: CircleDot,
                    bgClass: "bg-gradient-to-br from-sky-500/[0.08] to-cyan-500/[0.04] border-sky-500/25",
                    iconBubbleClass: "bg-sky-500 text-white shadow-sm shadow-sky-500/20",
                    titleClass: "text-sky-900 dark:text-sky-200",
                    subClass: "text-sky-600 dark:text-sky-400",
                    triggerClass: "border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10",
                  };

                  const StatusIcon = bannerConfig.icon;

                  return (
                    <div className={`p-3 rounded-none border flex items-center justify-between gap-3 ${bannerConfig.bgClass}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${bannerConfig.iconBubbleClass}`}>
                          <StatusIcon className={`h-4 w-4 ${ticket.status === "in_progress" ? "animate-spin" : ""}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold leading-tight truncate ${bannerConfig.titleClass}`}>
                            {bannerConfig.title}
                          </p>
                          <p className={`text-[11px] leading-tight truncate mt-0.5 ${ticket.waiting_for_user_confirmation && ticket.status !== "resolved" ? "text-sky-600 dark:text-sky-400 font-medium" : bannerConfig.subClass}`}>
                            {ticket.waiting_for_user_confirmation && ticket.status !== "resolved"
                              ? "Megoldás visszaigazolásra vár az ügyféltől"
                              : bannerConfig.sub}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isAdmin ? (
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
                            <SelectTrigger className={`h-7 text-xs px-2.5 rounded-full font-medium backdrop-blur-sm shadow-xs min-w-[115px] ${bannerConfig.triggerClass}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="created">Nyitott</SelectItem>
                              <SelectItem value="assigned">Hozzárendelt</SelectItem>
                              <SelectItem value="in_progress">Folyamatban</SelectItem>
                              <SelectItem value="resolved">Megoldva</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <TicketStatusBadge status={ticket.status} waitingForConfirmation={ticket.waiting_for_user_confirmation} />
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Admin quick resolution confirmation controls in sidebar */}
                {isAdmin && ticket.status !== "resolved" && (
                  <div className="pt-0.5">
                    {ticket.waiting_for_user_confirmation ? (
                      <div className="flex items-center justify-between p-2 rounded-none bg-sky-500/10 border border-sky-500/25 text-xs text-sky-700 dark:text-sky-300">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Clock className="h-3.5 w-3.5 text-sky-500" />
                          Visszaigazolásra vár
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-1.5"
                          disabled={isUpdating}
                          onClick={() =>
                            updateStatus({
                              feedbackId: ticket.id,
                              status: "in_progress" as TicketStatus,
                            })
                          }
                        >
                          Kérés visszavonása
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-8 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
                        disabled={!ticket.assigned_to || isRequestingResolution}
                        onClick={() =>
                          requestResolution(
                            { feedbackId: ticket.id },
                            {
                              onSuccess: () => {
                                toast({
                                  title: "Megerősítés-kérés elküldve",
                                  description: "A hibajegy állapota visszaigazolásra váróra váltott.",
                                });
                              },
                              onError: (err: any) => {
                                toast({
                                  variant: "destructive",
                                  title: "Hiba",
                                  description: err?.message || "Nem sikerült elküldeni a kérést.",
                                });
                              },
                            }
                          )
                        }
                      >
                        {isRequestingResolution ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                        Megoldás visszaigazolás kérése
                      </Button>
                    )}
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {ticket.user_name ? (
                        <>
                          <span className="text-foreground font-medium">{ticket.user_name}</span>{" "}
                          <span>({ticket.user_email})</span>
                        </>
                      ) : (
                        <span className="text-foreground font-medium">{ticket.user_email || "—"}</span>
                      )}
                    </span>
                  </div>
                  {isStaffInitiated && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Headset className="h-4 w-4 shrink-0" />
                      <span className="truncate flex items-center gap-1.5">
                        <span className="text-foreground font-medium">{ticket.created_by_name || staffEvent?.actor_name || "Management"}</span>
                        <ThinkAiBadge size="xs" iconOnly />
                      </span>
                    </div>
                  )}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={ticket.page_url}
                            onClick={(e) => { e.preventDefault(); navigate(ticket.page_url!); }}
                            className="truncate text-xs text-primary hover:underline cursor-pointer"
                          >
                            {ticket.page_url}
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {ticket.page_url}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Link2 className="h-4 w-4 shrink-0" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/tickets/${ticket.id}`;
                            navigator.clipboard.writeText(url);
                            toast({ title: "Link másolva!", description: "A hibajegy közvetlen linkje a vágólapra került." });
                          }}
                          className="truncate text-xs text-primary hover:underline cursor-pointer text-left"
                        >
                          /tickets/{ticket.id.slice(0, 8)}…
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Kattints a link másolásához
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <Separator />

                {/* Structured Properties Card — Layout 3 */}
                <div className="rounded-none border border-border/60 bg-muted/15 divide-y divide-border/40 overflow-hidden text-sm">
                  {/* Típus */}
                  <div className="flex items-center justify-between p-2.5 px-3 gap-2">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      Típus
                    </span>
                    <div>
                      {ticket.type === "bug" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                          <Bug className="h-3 w-3 text-red-500" />
                          Hibajelentés
                        </span>
                      ) : ticket.type === "question" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20">
                          <HelpCircle className="h-3 w-3 text-sky-500" />
                          Kérdés
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          <Lightbulb className="h-3 w-3 text-amber-500" />
                          Visszajelzés
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Prioritás */}
                  <div className="flex items-center justify-between p-2.5 px-3 gap-2">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                      Prioritás
                    </span>
                    <div>
                      {isAdmin ? (
                        <Select
                          value={ticket.priority || "medium"}
                          onValueChange={(val) =>
                            updatePriority({
                              feedbackId: ticket.id,
                              priority: val as TicketPriority,
                            })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs px-2.5 border-border/80 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Alacsony</SelectItem>
                            <SelectItem value="medium">Közepes</SelectItem>
                            <SelectItem value="high">Magas</SelectItem>
                            <SelectItem value="critical">Kritikus</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <TicketPriorityBadge priority={ticket.priority} />
                      )}
                    </div>
                  </div>

                  {/* Felelős */}
                  <div className="flex items-center justify-between p-2.5 px-3 gap-2">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                      <Headset className="h-3.5 w-3.5 text-muted-foreground" />
                      Felelős
                    </span>
                    <div className="max-w-[65%]">
                      {isAdmin ? (
                        <Select
                          value={(ticket as any).assigned_to || "unassigned"}
                          onValueChange={(val) => {
                            const newAssignee = val === "unassigned" ? null : val;
                            updateAssignee(
                              {
                                feedbackId: ticket.id,
                                assignedTo: newAssignee,
                                force: !newAssignee,
                              },
                              {
                                onError: (err: any) => {
                                  if (err?.message === "ALREADY_ASSIGNED") {
                                    toast({
                                      title: "Jegy már kiosztva",
                                      description: "Ezt a hibajegyet egy másik support munkatárs már magához rendelte.",
                                      variant: "destructive",
                                    });
                                  }
                                },
                              }
                            );
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs px-2.5 border-border/80 bg-background truncate">
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
                          <div className="flex items-center gap-2 text-right justify-end">
                            <ThinkAiIcon className="h-4 w-4 shrink-0" />
                            <div className="text-left min-w-0">
                              <p className="text-xs font-semibold truncate text-foreground">{ticket.assigned_to_name}</p>
                              <p className="text-[10px] text-muted-foreground leading-none">ThinkAI</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Nincs hozzárendelve</span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Jegy története (Timeline) */}
            <TicketTimeline feedbackId={feedbackId} isStaffInitiated={isStaffInitiated} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
