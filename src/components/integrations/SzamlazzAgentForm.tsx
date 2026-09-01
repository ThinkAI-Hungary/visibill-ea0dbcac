import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Key, RefreshCw, Trash2, Eye, EyeOff, Shield, ExternalLink, Zap, Info, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const SzamlazzAgentForm: React.FC = () => {
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const isOwner = selectedCompany?.owner_id === user?.id;

  const [agentKey, setAgentKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadKey();
  }, [selectedCompany?.id]);

  const loadKey = async () => {
    if (!selectedCompany?.id) {
      setSavedKey(null);
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);
    try {
      // 1. Try dedicated RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_szamlazz_agent_key', {
        p_company_id: selectedCompany.id,
      });

      if (!rpcErr && rpcData) {
        setSavedKey('••••••••••••••••••••••••••••••••••••••••••');
        setInitialLoading(false);
        return;
      }

      // 2. Fallback to direct companies table select
      const { data: cData, error: cErr } = await supabase
        .from('companies')
        .select('szamlazz_agent_key')
        .eq('id', selectedCompany.id)
        .maybeSingle();

      if (!cErr && (cData as any)?.szamlazz_agent_key) {
        setSavedKey('••••••••••••••••••••••••••••••••••••••••••');
      } else {
        setSavedKey(null);
      }
    } catch (e) {
      console.error('Failed to load Számlázz Agent key:', e);
      setSavedKey(null);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmed = agentKey.trim();
    if (!trimmed) {
      toast({
        title: 'Hiányos adat',
        description: 'Kérlek add meg a Számlázz.hu Agent API kulcsot!',
        variant: 'destructive',
      });
      return;
    }

    if (trimmed.length < 30) {
      toast({
        title: 'Érvénytelen kulcs formátum',
        description: 'A Számlázz.hu Agent kulcs jellemzően 42 karakter hosszú.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Call dedicated SECURITY DEFINER RPC
      const { error: rpcErr } = await supabase.rpc('save_szamlazz_agent_key', {
        p_company_id: selectedCompany!.id,
        p_agent_key: trimmed,
      });

      if (rpcErr) {
        // Fallback to direct companies table update
        const { error: cErr } = await supabase
          .from('companies')
          .update({ szamlazz_agent_key: trimmed, updated_at: new Date().toISOString() } as any)
          .eq('id', selectedCompany!.id);

        if (cErr) throw rpcErr || cErr;
      }

      setSavedKey('••••••••••••••••••••••••••••••••••••••••••');
      setAgentKey('');
      toast({
        title: 'Sikeres mentés!',
        description: 'A Számlázz.hu Számla Agent kulcs eltárolásra került.',
      });
    } catch (err: any) {
      toast({
        title: 'Mentési hiba',
        description: err.message || 'Nem sikerült elmenteni az API kulcsot.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Biztosan törölni szeretnéd a mentett Számlázz.hu Agent kulcsot?')) return;

    setLoading(true);
    try {
      const { error: rpcErr } = await supabase.rpc('delete_szamlazz_agent_key', {
        p_company_id: selectedCompany!.id,
      });

      if (rpcErr) {
        const { error: cErr } = await supabase
          .from('companies')
          .update({ szamlazz_agent_key: null } as any)
          .eq('id', selectedCompany!.id);

        if (cErr) throw rpcErr || cErr;
      }

      setSavedKey(null);
      setAgentKey('');
      toast({
        title: 'Kulcs törölve',
        description: 'A Számlázz.hu Agent kulcs eltávolításra került.',
      });
    } catch (err: any) {
      toast({
        title: 'Törlési hiba',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Card className="border-primary/10">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
          Számlázz.hu integráció betöltése...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10 hover:border-primary/20 transition-colors h-full flex flex-col justify-between">
      <div>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500/20 to-orange-500/5 rounded-xl flex items-center justify-center border border-orange-500/20">
              <FileText className="w-6 h-6 text-orange-500" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Számlázz.hu Számla Agent</CardTitle>
                {savedKey ? (
                  <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Aktív
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Nincs beállítva
                  </Badge>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help ml-auto" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>A Számlázz.hu fiókvédett számlák PDF számlaképének letöltéséhez szükséges API kulcs (0 Ft felár).</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardDescription className="text-sm">
                Automatikus PDF letöltés értesítőkből
              </CardDescription>
              {/* Feature Pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <Zap className="h-3 w-3" />
                  0 Ft / Díjmentes
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-medium">
                  <Key className="h-3 w-3" />
                  42 Karakteres API
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <Alert className="bg-muted/40 border-muted">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
              A Számlázz.hu-n beállított fiókvédett számlák PDF letöltéséhez adja meg a 42 karakteres <strong>Számla Agent kulcsot</strong>. A lekérés teljesen <strong>díjmentes</strong> (0 Ft).
            </AlertDescription>
          </Alert>

          {savedKey ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2.5">
                  <Key className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-mono text-xs font-semibold text-foreground tracking-widest">
                    {savedKey}
                  </span>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={loading}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 text-xs"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Leválasztás
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="szamlazz-agent-key" className="text-xs font-semibold">
                    Számla Agent API Kulcs (42 karakter)
                  </Label>
                  <a
                    href="https://www.szamlazz.hu"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    Hol találom? <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="szamlazz-agent-key"
                    type={showKey ? 'text' : 'password'}
                    value={agentKey}
                    onChange={(e) => setAgentKey(e.target.value)}
                    placeholder="Pl: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1"
                    className="font-mono text-xs pr-10"
                    disabled={!isOwner}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isOwner ? (
                <Button
                  onClick={handleSave}
                  disabled={loading || !agentKey.trim()}
                  className="w-full h-9 text-xs font-medium gap-2"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                  Számlázz.hu Agent Kulcs Mentése
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Csak a cég tulajdonosa rögzítheti az API kulcsot.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </div>

      <div className="p-4 pt-0 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/40 mt-4">
        <span>API Végpont: szamlazz.hu/szamla</span>
        <a
          href="https://www.szamlazz.hu/szamla/docs/szamla_agent/"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          API Dokumentáció <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </Card>
  );
};

export default SzamlazzAgentForm;
