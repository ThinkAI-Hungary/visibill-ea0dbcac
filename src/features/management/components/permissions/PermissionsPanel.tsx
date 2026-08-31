import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '../common/ManagementSkeleton';
import { ModuleMatrix } from './ModuleMatrix';
import { fetchManagementData, postManagementData } from '../../api/managementApi';
import { ControlCenterUser } from '../../api/types';
import { Users, Search, ShieldCheck, BookOpen, Save, Loader2, Building2 } from 'lucide-react';

interface PermissionsPanelProps {
  allUsers: ControlCenterUser[];
}

export function PermissionsPanel({ allUsers }: PermissionsPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Driving searchUser from URL parameter perm_q
  const searchUser = searchParams.get('perm_q') || '';
  const [search, setSearch] = useState(searchUser);

  const selectedUserId = searchParams.get('userId') || null;

  const setSelectedUserId = useCallback((userId: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (userId) {
      nextParams.set('userId', userId);
    } else {
      nextParams.delete('userId');
    }
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  // Helper to update parameter atomically
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== null && val !== '') {
        next.set(key, val);
      } else {
        next.delete(key);
      }
    });
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  // Debounce sync local input value to URL search parameter
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== searchUser) {
        updateParams({ perm_q: search });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, searchUser, updateParams]);

  // Sync local search input when URL changes externally
  useEffect(() => {
    setSearch(searchUser);
  }, [searchUser]);

  const [pendingChanges, setPendingChanges] = useState<Map<string, { canRead: boolean; canWrite: boolean }>>(new Map());
  const [isSupportAdmin, setIsSupportAdmin] = useState<boolean>(false);
  const [eaisybooksAccess, setEaisybooksAccess] = useState<boolean>(false);
  const [selectedEbCompany, setSelectedEbCompany] = useState<string | null>(null);
  const [selectedAbFirm, setSelectedAbFirm] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'eaisybill' | 'accounty'>('eaisybill');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setPendingChanges(new Map());
    setSelectedEbCompany(null);
    setSelectedAbFirm(null);
  }, [selectedUserId]);

  const filteredUsers = useMemo(() => {
    if (!searchUser.trim()) return allUsers;
    const q = searchUser.toLowerCase();
    return allUsers.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.companies && u.companies.some(c => (c.name || '').toLowerCase().includes(q)))
    );
  }, [allUsers, searchUser]);

  // Fetch selected user's permissions
  const { data: userPerms, isLoading: permsLoading } = useQuery<any>({
    queryKey: ['management-user-permissions', selectedUserId],
    queryFn: () => fetchManagementData('user-permissions', { userId: selectedUserId! }),
    enabled: !!selectedUserId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (userPerms) {
      setIsSupportAdmin(userPerms.isSupportAdmin || false);
      setEaisybooksAccess(userPerms.eaisybooksAccess || false);
    }
  }, [userPerms]);

  const handleToggle = (platform: string, companyOrFirmId: string, moduleName: string, field: 'canRead' | 'canWrite', currentValue: boolean) => {
    const nextVal = !currentValue;
    
    setPendingChanges(prev => {
      const next = new Map(prev);
      const readKey = `${platform}:${companyOrFirmId}:${moduleName}:canRead`;
      const writeKey = `${platform}:${companyOrFirmId}:${moduleName}:canWrite`;

      // Find original DB values for both fields
      const currentMod = userPerms?.eaisybill?.find((c: any) => c.companyId === companyOrFirmId)?.modules?.find((m: any) => m.module === moduleName)
        || userPerms?.accounty?.find((a: any) => a.firmId === companyOrFirmId)?.modules?.find((m: any) => m.module === moduleName);
      const origRead = currentMod?.canRead ?? true;
      const origWrite = currentMod?.canWrite ?? true;
      const effectiveRead = prev.get(readKey)?.canRead ?? origRead;
      const effectiveWrite = prev.get(writeKey)?.canWrite ?? origWrite;

      let newRead = effectiveRead;
      let newWrite = effectiveWrite;

      if (field === 'canRead' && !nextVal) {
        newRead = false;
        newWrite = false;
      } else if (field === 'canWrite' && nextVal) {
        newRead = true;
        newWrite = true;
      } else if (field === 'canRead') {
        newRead = true;
      } else {
        newWrite = false;
      }

      if (newRead !== origRead) {
        next.set(readKey, { canRead: newRead, canWrite: newWrite });
      } else {
        next.delete(readKey);
      }
      if (newWrite !== origWrite) {
        next.set(writeKey, { canRead: newRead, canWrite: newWrite });
      } else {
        next.delete(writeKey);
      }

      return next;
    });
  };

  const getEffectiveValue = (platform: string, companyOrFirmId: string, moduleName: string, field: 'canRead' | 'canWrite', originalValue: boolean): boolean => {
    const key = `${platform}:${companyOrFirmId}:${moduleName}:${field}`;
    const pending = pendingChanges.get(key);
    if (pending) return pending[field];
    return originalValue;
  };

  const isChanged = (platform: string, companyOrFirmId: string, moduleName: string, field: 'canRead' | 'canWrite', originalValue: boolean): boolean => {
    const key = `${platform}:${companyOrFirmId}:${moduleName}:${field}`;
    return pendingChanges.has(key);
  };

  const handleSave = async () => {
    if (!selectedUserId || !userPerms || (pendingChanges.size === 0 && isSupportAdmin === userPerms.isSupportAdmin && eaisybooksAccess === userPerms.eaisybooksAccess)) return;
    setSaving(true);
    setSaveMessage(null);

    const grouped = new Map<string, { platform: string; companyId?: string; firmId?: string; perms: Array<{ module: string; canRead: boolean; canWrite: boolean }> }>();

    for (const [key] of pendingChanges) {
      const [platform, entityId, moduleName] = key.split(':');
      const groupKey = `${platform}:${entityId}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          platform,
          companyId: platform === 'eaisybill' ? entityId : undefined,
          firmId: platform === 'accounty' ? entityId : undefined,
          perms: [],
        });
      }

      let originalCanRead = true;
      let originalCanWrite = true;

      if (platform === 'eaisybill') {
        const comp = userPerms.eaisybill?.find((e: any) => e.companyId === entityId);
        const mod = comp?.modules?.find((m: any) => m.module === moduleName);
        if (mod) { originalCanRead = mod.canRead; originalCanWrite = mod.canWrite; }
      } else {
        const firm = userPerms.accounty?.find((a: any) => a.firmId === entityId);
        const mod = firm?.modules?.find((m: any) => m.module === moduleName);
        if (mod) { originalCanRead = mod.canRead; originalCanWrite = mod.canWrite; }
      }

      const effectiveRead = getEffectiveValue(platform, entityId, moduleName, 'canRead', originalCanRead);
      const effectiveWrite = getEffectiveValue(platform, entityId, moduleName, 'canWrite', originalCanWrite);

      const group = grouped.get(groupKey)!;
      const existing = group.perms.find(p => p.module === moduleName);
      if (existing) {
        existing.canRead = effectiveRead;
        existing.canWrite = effectiveWrite;
      } else {
        group.perms.push({ module: moduleName, canRead: effectiveRead, canWrite: effectiveWrite });
      }
    }

    let totalErrors = 0;

    if (isSupportAdmin !== userPerms.isSupportAdmin) {
      const result = await postManagementData('update-permissions', {
        userId: selectedUserId,
        isSupportAdmin,
      });
      if (result?.error) totalErrors++;
    }

    if (eaisybooksAccess !== userPerms.eaisybooksAccess) {
      const result = await postManagementData('update-permissions', {
        userId: selectedUserId,
        eaisybooksAccess,
      });
      if (result?.error) totalErrors++;
    }

    for (const [, group] of grouped) {
      const result = await postManagementData('update-permissions', {
        userId: selectedUserId,
        platform: group.platform,
        companyId: group.companyId,
        firmId: group.firmId,
        permissions: group.perms,
      });
      if (result?.error) totalErrors++;
    }

    setSaving(false);
    setPendingChanges(new Map());

    if (totalErrors === 0) {
      setSaveMessage('✅ Mentve!');
      queryClient.invalidateQueries({ queryKey: ['management-user-permissions', selectedUserId] });
    } else {
      setSaveMessage('⚠️ Néhány módosítás nem sikerült');
    }

    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
      {/* ── User list (left column) ── */}
      <Card className="h-fit lg:max-h-[calc(100vh-240px)] lg:overflow-y-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Felhasználók
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Keresés név, email vagy cég..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {filteredUsers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nincs találat</p>
            )}
            {filteredUsers.map(u => (
              <button
                key={u.user_id}
                onClick={() => setSelectedUserId(u.user_id)}
                className={`w-full text-left px-4 py-3 transition-colors duration-150 hover:bg-accent/30 border-l-2
                  ${selectedUserId === u.user_id ? 'bg-primary/10 border-primary' : 'border-transparent'}`}
              >
                <p className="text-sm font-medium truncate">{u.name || '—'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                {u.companies && u.companies.length > 0 && (
                  <p className="text-[10.5px] text-muted-foreground/80 truncate mt-1 flex items-center gap-1.5" title={u.companies.map(c => c.name).join(', ')}>
                    <Building2 className="h-3 w-3 shrink-0 text-primary/70" />
                    <span className="truncate">{u.companies.map(c => c.name).join(', ')}</span>
                  </p>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Permission matrix (right column) ── */}
      <div className="space-y-4 w-full overflow-hidden">
        {!selectedUserId && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Válassz ki egy felhasználót a jogosultságok megtekintéséhez</p>
            </CardContent>
          </Card>
        )}

        {selectedUserId && permsLoading && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-48" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {selectedUserId && userPerms && !permsLoading && (
          <>
            {/* User info header */}
            <Card>
              <CardContent className="flex items-center justify-between p-4 gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="min-w-0 max-w-[200px] md:max-w-[250px] shrink-0">
                    <p className="font-semibold truncate" title={userPerms.name || ""}>{userPerms.name}</p>
                    <p className="text-xs text-muted-foreground truncate" title={userPerms.email}>{userPerms.email}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">{userPerms.profileRole}</Badge>
                  </div>
                  
                  {/* Vertical separator */}
                  <div className="h-8 w-px bg-border/60 shrink-0" />

                  {/* Support admin switch */}
                  <div className="flex items-center gap-2 bg-accent/20 px-3 py-1.5 rounded-lg border border-border/40 shrink-0">
                    <Switch
                      id="support-admin-toggle"
                      checked={isSupportAdmin}
                      onCheckedChange={setIsSupportAdmin}
                    />
                    <label htmlFor="support-admin-toggle" className="text-xs font-medium cursor-pointer select-none whitespace-nowrap">
                      Support munkatárs
                    </label>
                  </div>

                  {/* Vertical separator */}
                  <div className="h-8 w-px bg-border/60 shrink-0" />

                  {/* Eaisybooks access switch */}
                  <div className="flex items-center gap-2 bg-accent/20 px-3 py-1.5 rounded-lg border border-border/40 shrink-0">
                    <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                    <Switch
                      id="eaisybooks-access-toggle"
                      checked={eaisybooksAccess}
                      onCheckedChange={setEaisybooksAccess}
                    />
                    <label htmlFor="eaisybooks-access-toggle" className="text-xs font-medium cursor-pointer select-none whitespace-nowrap">
                      Eaisybooks hozzáférés
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {saveMessage && (
                    <span className="text-xs font-medium text-primary animate-in fade-in">{saveMessage}</span>
                  )}
                  {(() => {
                    const totalPending = pendingChanges.size 
                      + (isSupportAdmin !== userPerms.isSupportAdmin ? 1 : 0)
                      + (eaisybooksAccess !== userPerms.eaisybooksAccess ? 1 : 0);
                    return (
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={totalPending === 0 || saving}
                        className="gap-2"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Mentés {totalPending > 0 && `(${totalPending})`}
                      </Button>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Platform pill toggle */}
            {(userPerms.eaisybill?.length > 0 || userPerms.accounty?.length > 0) && (
              <div className="flex items-center gap-3">
                <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border/40">
                  {userPerms.eaisybill?.length > 0 && (
                    <button
                      onClick={() => setSelectedPlatform('eaisybill')}
                      style={{ width: 140 }}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border
                        ${selectedPlatform === 'eaisybill'
                          ? 'bg-primary/15 text-primary border-primary/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent'
                        }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      eaisyBill
                    </button>
                  )}
                  {userPerms.accounty?.length > 0 && (
                    <button
                      onClick={() => setSelectedPlatform('accounty')}
                      style={{ width: 140 }}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border
                        ${selectedPlatform === 'accounty'
                          ? 'bg-primary/15 text-primary border-primary/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent'
                        }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      eaisyBooks
                    </button>
                  )}
                </div>

                {/* Company dropdown */}
                {selectedPlatform === 'eaisybill' && userPerms.eaisybill?.length > 1 && (
                  <select
                    value={selectedEbCompany || userPerms.eaisybill[0]?.companyId}
                    onChange={e => setSelectedEbCompany(e.target.value)}
                    className="text-xs bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer text-foreground"
                    style={{ colorScheme: 'dark' }}
                  >
                    {userPerms.eaisybill.map((c: any) => (
                      <option key={c.companyId} value={c.companyId}>{c.companyName} ({c.role})</option>
                    ))}
                  </select>
                )}
                {selectedPlatform === 'accounty' && userPerms.accounty?.length > 1 && (
                  <select
                    value={selectedAbFirm || `${userPerms.accounty[0]?.firmId}__${userPerms.accounty[0]?.companyId}`}
                    onChange={e => setSelectedAbFirm(e.target.value)}
                    className="text-xs bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer text-foreground"
                    style={{ colorScheme: 'dark' }}
                  >
                    {userPerms.accounty.map((a: any) => (
                      <option key={`${a.firmId}__${a.companyId}`} value={`${a.firmId}__${a.companyId}`}>
                        {a.firmName} · {a.companyName} ({a.role})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Active platform content */}
            {selectedPlatform === 'eaisybill' && userPerms.eaisybill?.length > 0 && (() => {
              const ebId = selectedEbCompany || userPerms.eaisybill[0]?.companyId;
              const ebComp = userPerms.eaisybill.find((c: any) => c.companyId === ebId) || userPerms.eaisybill[0];
              return ebComp ? (
                <ModuleMatrix
                  key={ebComp.companyId}
                  title={ebComp.companyName}
                  subtitle={`Szerepkör: ${ebComp.role}`}
                  platform="eaisybill"
                  entityId={ebComp.companyId}
                  modules={ebComp.modules}
                  getEffectiveValue={getEffectiveValue}
                  isChanged={isChanged}
                  onToggle={handleToggle}
                />
              ) : null;
            })()}

            {selectedPlatform === 'accounty' && userPerms.accounty?.length > 0 && (() => {
              const abId = selectedAbFirm || `${userPerms.accounty[0]?.firmId}__${userPerms.accounty[0]?.companyId}`;
              const abEntry = userPerms.accounty.find((a: any) => `${a.firmId}__${a.companyId}` === abId) || userPerms.accounty[0];
              return abEntry ? (
                <ModuleMatrix
                  key={`${abEntry.firmId}-${abEntry.companyId}`}
                  title={abEntry.firmName}
                  subtitle={`Szerepkör: ${abEntry.role} · Ügyfél: ${abEntry.companyName}`}
                  platform="accounty"
                  entityId={abEntry.firmId}
                  modules={abEntry.modules}
                  getEffectiveValue={getEffectiveValue}
                  isChanged={isChanged}
                  onToggle={handleToggle}
                />
              ) : null;
            })()}

            {(!userPerms.eaisybill || userPerms.eaisybill.length === 0) && (!userPerms.accounty || userPerms.accounty.length === 0) && (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-sm text-muted-foreground">Ez a felhasználó nincs hozzárendelve egyetlen céghez sem.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
