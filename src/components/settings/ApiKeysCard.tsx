import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Terminal,
  FileCode2,
  BookOpen,
  Play,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ApiDocsExplorer, ApiDocsView } from './ApiDocsExplorer';

interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scope: string;
  company_id: string | null;
  user_id: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export function ApiKeysCard() {
  const { user } = useAuth();
  const { companies } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState<'read' | 'read_write'>('read_write');
  const [newKeyTarget, setNewKeyTarget] = useState<string>('all'); // 'all' or company_id
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
  const [showCurlExample, setShowCurlExample] = useState(false);
  const [showDocsExplorer, setShowDocsExplorer] = useState(false);

  // Fetch API keys
  const { data: apiKeys = [], isLoading, isError, refetch } = useQuery<ApiKeyItem[]>({
    queryKey: queryKeys.apiKeys(user?.id),
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, scope, company_id, user_id, is_active, last_used_at, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        reportError({
          type: 'db_query',
          component: 'ApiKeysCard',
          action: 'fetchApiKeys',
          message: 'Failed to fetch API keys',
          error,
        });
        throw error;
      }

      return (data || []) as ApiKeyItem[];
    },
    enabled: !!user,
  });

  // Mutation: Generate API Key
  const generateMutation = useMutation({
    mutationFn: async () => {
      const companyIdParam = newKeyTarget === 'all' ? null : newKeyTarget;
      const { data, error } = await supabase.rpc('generate_api_key', {
        p_name: newKeyName.trim() || 'Ügyfél M2M API Kulcs',
        p_scope: newKeyScope,
        p_company_id: companyIdParam,
        p_user_id: user?.id,
      });

      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      setGeneratedKey(data?.api_key || null);
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys(user?.id) });
      toast({
        title: 'Siker',
        description: 'Az API kulcs sikeresen legenerálva! Kérjük mentsd el a kulcsot.',
      });
    },
    onError: (err: any) => {
      reportError({
        type: 'db_query',
        component: 'ApiKeysCard',
        action: 'generateApiKey',
        message: 'Key generation failed',
        error: err,
      });
      toast({
        title: 'Hiba történt',
        description: err.message || 'Nem sikerült az API kulcs generálása.',
        variant: 'destructive',
      });
    },
  });

  // Mutation: Revoke API Key
  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase.rpc('revoke_api_key', {
        p_key_id: keyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys(user?.id) });
      setRevokeTarget(null);
      toast({
        title: 'Visszavonva',
        description: 'Az API kulcs sikeresen vissza lett vonva. A további kérések elutasításra kerülnek.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a visszavonáskor',
        description: err.message || 'Nem sikerült visszavonni a kulcsot.',
        variant: 'destructive',
      });
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast({
      title: 'Kimásolva',
      description: 'API kulcs a vágólapra másolva.',
    });
  };

  const handleOpenCreate = () => {
    setNewKeyName('');
    setNewKeyScope('read_write');
    setNewKeyTarget('all');
    setGeneratedKey(null);
    setCreateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setGeneratedKey(null);
  };

  const companyMap = new Map((companies || []).map((c) => [c.id, c.name]));

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Key className="h-5 w-5 text-primary" />
            Programozói Hozzáférés & API Kulcsok
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
            Biztonságos REST API hozzáférés külső rendszerek, ERP-k és szkriptek integrációjához.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDocsExplorer(true)}
            className="text-xs gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Élő Végpont Tesztelő
          </Button>
          <Button
            variant={showCurlExample ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowCurlExample(!showCurlExample)}
            className="text-xs gap-1.5"
          >
            <Terminal className="h-3.5 w-3.5" />
            {showCurlExample ? 'Dokumentáció elrejtése' : 'API Dokumentáció'}
          </Button>
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 text-xs">
            <Plus className="h-4 w-4" />
            Új API kulcs
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Full API Documentation & Explorer (Inline) */}
        {showCurlExample && (
          <div className="rounded-lg border border-primary/20 bg-card p-4 space-y-3 text-xs shadow-sm">
            <ApiDocsView
              defaultApiKey={generatedKey || (apiKeys.length > 0 ? 'vb_...' : '')}
              isInline={true}
              onMaximize={() => setShowDocsExplorer(true)}
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center space-y-2">
            <p className="text-xs text-destructive font-medium">Hiba történt az API kulcsok betöltésekor.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
              Újrapróbálkozás
            </Button>
          </div>
        )}

        {/* Loaded State: List of Keys */}
        {!isLoading && !isError && apiKeys.length > 0 && (
          <div className="divide-y divide-border/50 rounded-md border border-border/50 bg-background/50">
            {apiKeys.map((key) => {
              const targetCompanyName = key.company_id
                ? companyMap.get(key.company_id) || 'Specifikus cég'
                : 'Összes saját cég (Globális)';

              return (
                <div
                  key={key.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{key.name}</span>
                      <code className="px-2 py-0.5 bg-muted rounded font-mono text-xs font-semibold tracking-wider text-muted-foreground">
                        {key.key_prefix}...
                      </code>
                      <Badge
                        variant={key.scope === 'read_write' ? 'default' : 'secondary'}
                        className="text-[10px] font-medium uppercase tracking-wider"
                      >
                        {key.scope === 'read_write' ? 'Írás / Olvasás' : 'Csak Olvasás'}
                      </Badge>
                      {key.is_active ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Aktív
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">
                          Visszavonva
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>Hatáskör: <strong className="text-foreground font-medium">{targetCompanyName}</strong></span>
                      <span>•</span>
                      <span>
                        Létrehozva: {new Date(key.created_at).toLocaleDateString('hu-HU')}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {key.last_used_at
                          ? `Utoljára: ${new Date(key.last_used_at).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                          : 'Még nem használt'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {key.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevokeTarget(key)}
                        className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2.5"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Visszavonás
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && apiKeys.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Key className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">Még nincs létrehozott API kulcsod</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Hozz létre egy új API kulcsot, hogy programozottan, biztonságosan lekérdezhesd vagy módosíthasd a cégeid adatait és beállításait.
              </p>
            </div>
            <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 text-xs">
              <Plus className="h-4 w-4" />
              Első API kulcs generálása
            </Button>
          </div>
        )}
      </CardContent>

      {/* ── Dialog: Create / Show API Key ── */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              {generatedKey ? 'API Kulcs Sikeresen Létrehozva' : 'Új Ügyfél API Kulcs Generálása'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {generatedKey
                ? 'Kérjük, másold ki a kulcsot most, mert biztonsági okokból később nem tekinthető meg újra.'
                : 'Adj nevet a kulcsnak és válaszd ki a kívánt hozzáférési szintet.'}
            </DialogDescription>
          </DialogHeader>

          {!generatedKey ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="key-name" className="text-xs font-medium">Kulcs Megnevezése</Label>
                <Input
                  id="key-name"
                  placeholder="pl. Belső ERP integráció vagy Külső automatizáció"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="key-scope" className="text-xs font-medium">Jogosultsági Szint (Scope)</Label>
                <Select value={newKeyScope} onValueChange={(val: any) => setNewKeyScope(val)}>
                  <SelectTrigger id="key-scope" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read_write" className="text-xs">
                      Írás és Olvasás (read_write) — Lekérdezés & Cégadat-módosítás
                    </SelectItem>
                    <SelectItem value="read" className="text-xs">
                      Csak Olvasás (read) — Biztonságos lekérdezés, módosítás tiltva
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="key-target" className="text-xs font-medium">Cég Hatáskör</Label>
                <Select value={newKeyTarget} onValueChange={setNewKeyTarget}>
                  <SelectTrigger id="key-target" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-semibold">
                      Összes saját cégem (Globális felhasználói kulcs)
                    </SelectItem>
                    {companies?.map((comp) => (
                      <SelectItem key={comp.id} value={comp.id} className="text-xs">
                        {comp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  A globális kulcs automatikusan érvényes minden olyan cégre, ahol tulajdonos vagy admin vagy.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold">Figyelem: Ez a kulcs CSAK MOST jelenik meg!</p>
                  <p className="text-muted-foreground text-[11px]">
                    Az adatbázis kizárólag a kulcs SHA-256 lenyomatát tárolja. Ha elveszíted, újat kell generálnod.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Generált API Kulcs</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedKey}
                    className="font-mono text-xs font-bold tracking-wider select-all bg-muted text-foreground"
                  />
                  <Button
                    type="button"
                    onClick={() => handleCopy(generatedKey)}
                    className="shrink-0 gap-1.5"
                    size="sm"
                  >
                    {copiedKey ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    {copiedKey ? 'Másolva' : 'Másolás'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-row items-center justify-between sm:justify-between pt-2">
            {!generatedKey ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleCloseDialog} className="text-xs">
                  Mégse
                </Button>
                <Button
                  size="sm"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="text-xs"
                >
                  {generateMutation.isPending ? 'Generálás...' : 'Kulcs létrehozása'}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleCloseDialog} className="w-full text-xs">
                Kész, elmentettem a kulcsot
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Alert Dialog: Revoke Key Confirmation ── */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              API Kulcs Visszavonása
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Biztosan vissza szeretnéd vonni a(z) <strong>{revokeTarget?.name}</strong> (<code>{revokeTarget?.key_prefix}...</code>) API kulcsot?
              <br />
              A visszavonás után az ehhez a kulcshoz kapcsolódó összes külső szkript és integráció azonnal elutasításra kerül.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
              className="bg-destructive hover:bg-destructive/90 text-xs"
            >
              {revokeMutation.isPending ? 'Visszavonás folyamatban...' : 'Igen, kulcs visszavonása'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modal: Comprehensive API Documentation & Interactive Live Tester ── */}
      <ApiDocsExplorer
        open={showDocsExplorer}
        onOpenChange={setShowDocsExplorer}
        defaultApiKey={generatedKey || ''}
      />
    </Card>
  );
}
