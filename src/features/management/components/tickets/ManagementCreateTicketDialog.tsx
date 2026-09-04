import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useSupportAgents } from "@/hooks/useTickets";
import { useManagementCreateTicket } from "../../hooks/useManagementCreateTicket";
import { uploadTicketImage, isAllowedTicketFile, MAX_FILE_SIZE } from "@/lib/upload-ticket-image";
import { useToast } from "@/hooks/use-toast";
import {
  TicketPlus,
  User,
  Building2,
  Headset,
  Bug,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Paperclip,
  Trash2,
  Loader2,
  Search,
  Check,
  ChevronsUpDown,
  X,
  FileText,
} from "lucide-react";

export interface ManagementUserOption {
  id: string;
  user_id: string;
  name: string;
  email: string;
  companies?: Array<{ id: string; name: string; role: string }>;
}

interface ManagementCreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: ManagementUserOption[];
  onTicketCreated?: (ticket: any) => void;
}

const MAX_ATTACHMENTS = 5;

export function ManagementCreateTicketDialog({
  open,
  onOpenChange,
  users,
  onTicketCreated,
}: ManagementCreateTicketDialogProps) {
  const { toast } = useToast();
  const { data: supportAgents = [] } = useSupportAgents();
  const { mutateAsync: createTicket, isPending: isSubmitting } = useManagementCreateTicket();

  // Form states
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);

  const [companyId, setCompanyId] = useState<string>("");
  const [service, setService] = useState<string>("eaisybill");
  const [type, setType] = useState<string>("bug");
  const [priority, setPriority] = useState<string>("medium");
  const [assignedTo, setAssignedTo] = useState<string>("unassigned");
  const [message, setMessage] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [editorKey, setEditorKey] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Currently selected user object
  const selectedUser = useMemo(() => {
    return users.find((u) => u.user_id === selectedUserId);
  }, [users, selectedUserId]);

  // Companies associated with selected user
  const userCompanies = useMemo(() => {
    return selectedUser?.companies || [];
  }, [selectedUser]);

  // Filtered users for Combobox search
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users.slice(0, 100);
    const q = userSearch.toLowerCase();
    return users
      .filter((u) => {
        const nameMatch = u.name?.toLowerCase().includes(q);
        const emailMatch = u.email?.toLowerCase().includes(q);
        const compMatch = u.companies?.some((c) => c.name?.toLowerCase().includes(q));
        return nameMatch || emailMatch || compMatch;
      })
      .slice(0, 100);
  }, [users, userSearch]);

  // Reset form
  const resetForm = useCallback(() => {
    setSelectedUserId("");
    setUserSearch("");
    setIsUserPopoverOpen(false);
    setCompanyId("");
    setService("eaisybill");
    setType("bug");
    setPriority("medium");
    setAssignedTo("unassigned");
    setMessage("");
    setAttachments([]);
    setEditorKey((k) => k + 1);
    setIsDragOver(false);
  }, []);

  // When dialog opens, reset form
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  // Auto-manage company selection when user changes
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setIsUserPopoverOpen(false);
    setUserSearch("");

    const target = users.find((u) => u.user_id === userId);
    if (target?.companies && target.companies.length === 1) {
      setCompanyId(target.companies[0].id);
    } else if (target?.companies && target.companies.length > 1) {
      // Default to first company, or leave empty for user choice
      setCompanyId(target.companies[0].id);
    } else {
      setCompanyId("none");
    }
  };

  // ── Attachments Handling ──
  const validateAndAddFiles = useCallback(
    (files: FileList | File[]) => {
      const newFiles: File[] = [];
      for (const file of Array.from(files)) {
        if (!isAllowedTicketFile(file)) {
          toast({
            variant: "destructive",
            title: "Nem támogatott fájltípus",
            description: `${file.name}: Csak kép, PDF, CSV, Excel és XML fájlok engedélyezettek.`,
          });
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast({
            variant: "destructive",
            title: "A fájl túl nagy",
            description: `${file.name}: A maximális méret 10 MB.`,
          });
          continue;
        }
        newFiles.push(file);
      }

      setAttachments((prev) => {
        const combined = [...prev, ...newFiles];
        if (combined.length > MAX_ATTACHMENTS) {
          toast({
            variant: "destructive",
            title: "Túl sok csatolmány",
            description: `Legfeljebb ${MAX_ATTACHMENTS} fájl csatolható egyszerre.`,
          });
          return combined.slice(0, MAX_ATTACHMENTS);
        }
        return combined;
      });
    },
    [toast]
  );

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Validation
  const isTextNotEmpty = Boolean(message && message.replace(/<[^>]*>/g, "").trim().length > 0);
  const canSubmit = Boolean(selectedUserId && isTextNotEmpty && !isSubmitting);

  // Submit Handler
  const handleSubmit = async () => {
    if (!canSubmit || !selectedUser) return;

    try {
      const ticketId = crypto.randomUUID();

      // 1. Upload attachments if any
      let attachmentUrls: string[] = [];
      if (attachments.length > 0) {
        const uploadPromises = attachments.map((file) =>
          uploadTicketImage(file, selectedUser.user_id, ticketId)
        );
        attachmentUrls = await Promise.all(uploadPromises);
      }

      // 2. Resolve selected company details
      const selectedCompanyObj = userCompanies.find((c) => c.id === companyId);
      const finalCompanyId = companyId === "none" ? null : companyId || null;
      const finalCompanyName = selectedCompanyObj?.name || null;

      // 3. Post to backend
      const res = await createTicket({
        targetUserId: selectedUser.user_id,
        companyId: finalCompanyId,
        companyName: finalCompanyName,
        service,
        type,
        priority,
        message: message.trim(),
        attachments: attachmentUrls,
        assignedTo: assignedTo === "unassigned" ? null : assignedTo,
        pageUrl: "/management?view=tickets",
      });

      onTicketCreated?.(res.ticket);
      onOpenChange(false);
    } catch (err) {
      // Error toast is handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <TicketPlus className="h-5 w-5 text-primary" />
            Új hibajegy nyitása ügyfél nevében
          </DialogTitle>
          <DialogDescription>
            A létrehozott hibajegy közvetlenül a kiválasztott felhasználóhoz kapcsolódik, és az ő
            felületén fog megjelenni, mintha ő maga küldte volna be.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ═══ 1. Célfelhasználó Kiválasztása (Combobox) ═══ */}
          <div className="space-y-2 p-3.5 rounded-lg border border-border/80 bg-muted/20">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              Érintett Felhasználó (User) *
            </Label>

            <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  data-testid="user-combobox-trigger"
                  aria-expanded={isUserPopoverOpen}
                  className="w-full justify-between h-11 px-3 bg-background text-left font-normal"
                >
                  {selectedUser ? (
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {selectedUser.name?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <span className="font-medium text-foreground truncate">
                        {selectedUser.name || "Névtelen"}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        ({selectedUser.email})
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Search className="h-4 w-4" /> Válassz vagy keress felhasználót...
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                className="w-[460px] p-2"
                align="start"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Keresés név, email vagy cég alapján..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-8 h-9 text-xs"
                      autoFocus
                    />
                  </div>

                  <div
                    className="max-h-[260px] overflow-y-auto space-y-0.5 overscroll-contain pr-1"
                    tabIndex={-1}
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    {filteredUsers.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Nincs találat a keresésre.
                      </p>
                    ) : (
                      filteredUsers.map((u) => (
                        <button
                          key={u.user_id}
                          type="button"
                          onClick={() => handleSelectUser(u.user_id)}
                          className={`w-full flex items-center justify-between p-2 rounded-md text-left text-xs transition-colors hover:bg-accent ${
                            u.user_id === selectedUserId ? "bg-primary/10 text-primary font-medium" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                              {u.name?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <div className="truncate">
                              <p className="font-medium text-foreground truncate">
                                {u.name || "Névtelen"}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>

                          {u.user_id === selectedUserId && (
                            <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* ═══ 2. Cég és Szolgáltatás Választó ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cégválasztó */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Érintett Cég
              </Label>
              <Select
                value={companyId}
                onValueChange={setCompanyId}
                disabled={!selectedUserId}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={!selectedUserId ? "Előbb válassz usert" : "Válassz céget..."} />
                </SelectTrigger>
                <SelectContent>
                  {userCompanies.length > 0 ? (
                    userCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.role})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none">Nincs hozzárendelt cég (Egyéni)</SelectItem>
                  )}
                  {userCompanies.length > 0 && (
                    <SelectItem value="none">Egyéni / Cégfüggetlen jegy</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Szolgáltatás */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Szolgáltatás
              </Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eaisybill">eaisybill (Számlázó / Pénzügy)</SelectItem>
                  <SelectItem value="accounty">eaisyBooks (Könyvelés)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ═══ 3. Típus, Prioritás és Felelős Kijelölése ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Típus */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Bug className="h-3.5 w-3.5" />
                Típus
              </Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Hibajelentés (Bug)</SelectItem>
                  <SelectItem value="feedback">Visszajelzés (Feedback)</SelectItem>
                  <SelectItem value="question">Kérdés (Question)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prioritás */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Prioritás
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Alacsony</SelectItem>
                  <SelectItem value="medium">Közepes</SelectItem>
                  <SelectItem value="high">Magas</SelectItem>
                  <SelectItem value="critical">Kritikus (SLA)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Felelős (Assignee) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Headset className="h-3.5 w-3.5" />
                Kezdő Felelős
              </Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Kiosztatlan</SelectItem>
                  {supportAgents.map((agent) => (
                    <SelectItem key={agent.user_id} value={agent.user_id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ═══ 4. Szöveges Leírás (Rich Text Editor) ═══ */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Hibajegy leírása és részletei *</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Ctrl+Enter a beküldéshez
              </span>
            </Label>
            <div className="rounded-lg border border-border/80 overflow-hidden bg-background">
              <RichTextEditor
                key={editorKey}
                onChange={setMessage}
                placeholder="Írd le a hiba vagy kérdés részleteit (mit tapasztalt az ügyfél, melyik számlánál/oldalon stb.)..."
                minHeight="140px"
                toolbarVariant="ticket"
                onSubmit={handleSubmit}
              />
            </div>
          </div>

          {/* ═══ 5. Csatolmányok ═══ */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              Csatolmányok ({attachments.length}/{MAX_ATTACHMENTS})
            </Label>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files.length > 0) {
                  validateAndAddFiles(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border/70 hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.csv,.xls,.xlsx,.xml"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    validateAndAddFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Paperclip className="h-3.5 w-3.5" />
                Húzd ide a fájlokat, vagy <span className="text-primary font-medium">tallózz</span> (Kép, PDF, CSV, XML max 10MB)
              </p>
            </div>

            {/* Attached file badges */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((file, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="pl-2.5 pr-1.5 py-1 flex items-center gap-2 text-xs bg-muted/60"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[180px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachment(idx);
                      }}
                      className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between pt-3 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Mégse
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-w-[180px] justify-center tabular-nums gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Rögzítés folyamatban...</span>
              </>
            ) : (
              <>
                <TicketPlus className="h-4 w-4" />
                <span>Hibajegy Létrehozása</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
