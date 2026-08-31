import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '../common/ManagementSkeleton';
import { RoleBadge } from '../common/RoleBadge';
import { postManagementData } from '../../api/managementApi';
import { useToast } from '@/hooks/use-toast';
import { Users, Search, ChevronDown, ChevronRight, ChevronLeft, Trash2, AlertTriangle, Loader2, Building2 } from 'lucide-react';

interface UsersControlPanelProps {
  allUsers: any[];
  overviewLoading: boolean;
  companyCostMap: Map<string, any>;
  onOpenCompany: (id: string) => void;
}

export function UsersControlPanel({
  allUsers,
  overviewLoading,
  companyCostMap,
  onOpenCompany,
}: UsersControlPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const USER_PAGE_SIZE = 15;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Deletion state
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    setIsDeleting(true);
    try {
      const result = await postManagementData('delete-user', { userId: deleteUserId });
      if (result?.error) {
        toast({
          title: "Törlés sikertelen",
          description: result.error,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Felhasználó anonimizálva",
          description: "A felhasználó sikeresen anonimizálva és letiltva."
        });
        setIsDeleteOpen(false);
        setDeleteUserId(null);
        queryClient.invalidateQueries({ queryKey: ['management-overview'] });
      }
    } catch (err: any) {
      toast({
        title: "Törlés sikertelen",
        description: `Hiba történt a törlés során: ${err.message || err}`,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Deriving state from URL search params
  const searchUser = searchParams.get('usr_q') || '';
  const userPage = Number(searchParams.get('usr_page')) || 0;

  // Local input search state
  const [search, setSearch] = useState(searchUser);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Helper to update search parameters atomically
  const updateParams = useCallback((updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== null && val !== '') {
        next.set(key, String(val));
      } else {
        next.delete(key);
      }
    });
    // Reset page to 0 on query update
    if (!('usr_page' in updates)) {
      next.set('usr_page', '0');
    }
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  // Debounce sync local input search to URL search parameter
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== searchUser) {
        updateParams({ usr_q: search });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, searchUser, updateParams]);

  // Sync local search state when URL changes externally
  useEffect(() => {
    setSearch(searchUser);
  }, [searchUser]);

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    if (!searchUser.trim()) return allUsers;
    const q = searchUser.toLowerCase();
    return allUsers.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.companies && u.companies.some((c: any) => (c.name || '').toLowerCase().includes(q)))
    );
  }, [allUsers, searchUser]);

  const userTotalPages = Math.ceil(filteredUsers.length / USER_PAGE_SIZE);
  const paginatedUsers = useMemo(() =>
    filteredUsers.slice(userPage * USER_PAGE_SIZE, (userPage + 1) * USER_PAGE_SIZE)
  , [filteredUsers, userPage]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" aria-hidden="true" /> Felhasználók
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Keresés név, email vagy cég..."
            className="pl-8 h-8 text-xs w-56 bg-background"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs bg-muted/30">
                <th className="text-left py-3 px-5 font-medium" style={{ width: 40 }}></th>
                <th className="text-left py-3 px-2 font-medium">Név</th>
                <th className="text-center py-3 px-4 font-medium" style={{ width: 80 }}>Cégek</th>
                <th className="text-center py-3 px-4 font-medium" style={{ width: 80 }}>Műveletek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {overviewLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-3 px-5"><Skeleton className="h-4 w-4" /></td>
                    <td className="py-3 px-2"><Skeleton className="h-4 w-40" /></td>
                    <td className="py-3 px-4 text-center"><Skeleton className="h-5 w-8 mx-auto rounded-full" /></td>
                    <td className="py-3 px-4 text-center"><Skeleton className="h-8 w-8 mx-auto rounded-md" /></td>
                  </tr>
                ))
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Nincs találat</td>
                </tr>
              ) : paginatedUsers.map(u => {
                const isExpanded = expandedUserId === u.user_id;
                return (
                  <React.Fragment key={u.user_id}>
                    <tr
                      onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                      className="cursor-pointer hover:bg-accent/50 active:bg-accent/70
                                 transition-colors duration-150 group h-[52px]"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      aria-label={`${u.name || u.email} kibontása`}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedUserId(isExpanded ? null : u.user_id); } }}
                    >
                      <td className="py-3 px-5 w-8">
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </td>
                      <td className="py-3 px-2 overflow-hidden">
                        <div>
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-150 block truncate">
                            {u.name || 'N/A'}
                          </span>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {u.companies.length > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full
                            bg-primary/10 text-primary text-xs font-semibold border border-primary/20"
                            title={u.companies.map((c: any) => c.name).join(', ')}>
                            {u.companies.length}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => {
                            setDeleteUserId(u.user_id);
                            setDeleteUserName(u.name || u.email);
                            setIsDeleteOpen(true);
                          }}
                          title="Felhasználó törlése/anonimizálása"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                    {isExpanded && u.companies.length > 0 && (
                      <tr>
                        <td colSpan={4} className="p-0">
                          <div className="bg-muted/20 border-t border-border animate-in slide-in-from-top-1 duration-200">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b border-border/50">
                                  <th className="text-left py-2 px-6 font-medium">Cég</th>
                                  <th className="text-left py-2 px-3 font-medium">Rang</th>
                                  <th className="text-center py-2 px-3 font-medium">Számlák</th>
                                  <th className="text-center py-2 px-3 font-medium">NAV</th>
                                  <th className="text-center py-2 px-3 font-medium">Tranzakciók</th>
                                  <th className="text-center py-2 px-3 font-medium">Bér/járulék</th>
                                  <th className="text-right py-2 px-6 font-medium">Havi költség</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {u.companies.map((c: any) => {
                                  const stats = companyCostMap.get(c.id);
                                  return (
                                    <tr
                                      key={c.id}
                                      onClick={(e) => { e.stopPropagation(); onOpenCompany(c.id); }}
                                      className="cursor-pointer hover:bg-accent/40 transition-colors duration-150 group/company"
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onOpenCompany(c.id); } }}
                                    >
                                      <td className="py-2.5 px-6">
                                        <span className="font-medium text-foreground group-hover/company:text-primary transition-colors duration-150 flex items-center gap-1.5">
                                          {c.name}
                                          <ChevronRight className="h-3 w-3 opacity-0 group-hover/company:opacity-100 transition-opacity" />
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3"><RoleBadge role={c.role} /></td>
                                      <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.invoiceCount ?? '—'}</td>
                                      <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.navInvoiceCount ?? '—'}</td>
                                      <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.transactionCount ?? '—'}</td>
                                      <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.payrollCount ?? '—'}</td>
                                      <td className="py-2.5 px-6 text-right tabular-nums font-medium text-foreground">
                                        ${(stats?.monthlyCostUsd ?? 0).toFixed(4)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!overviewLoading && paginatedUsers.length > 0 && paginatedUsers.length < USER_PAGE_SIZE &&
                Array.from({ length: USER_PAGE_SIZE - paginatedUsers.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="pointer-events-none">
                    <td className="py-3 px-5">&nbsp;</td>
                    <td className="py-3 px-2 overflow-hidden">
                      <div>
                        <span className="block text-sm invisible">&nbsp;</span>
                        <p className="text-xs invisible">&nbsp;</p>
                      </div>
                    </td>
                    <td className="py-3 px-4"></td>
                    <td className="py-3 px-4"></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        {!overviewLoading && userTotalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border">
            <span className="text-xs text-muted-foreground tabular-nums">
              {filteredUsers.length === 0 ? '0' : `${userPage * USER_PAGE_SIZE + 1}–${Math.min((userPage + 1) * USER_PAGE_SIZE, filteredUsers.length)} / ${filteredUsers.length}`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={userPage === 0}
                onClick={() => updateParams({ usr_page: userPage - 1 })}
                aria-label="Előző oldal"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-2">{userPage + 1}/{userTotalPages}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={userPage >= userTotalPages - 1}
                onClick={() => updateParams({ usr_page: userPage + 1 })}
                aria-label="Következő oldal"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={isDeleteOpen} onOpenChange={open => { if (!isDeleting) setIsDeleteOpen(open); }}>
        <AlertDialogContent className="sm:max-w-md border-destructive/20 bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Felhasználó törlése/anonimizálása
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2 text-sm text-muted-foreground" asChild>
              <div className="space-y-3 pt-2 text-sm text-muted-foreground">
                <p>
                  Biztosan el akarod távolítani és anonimizálni a következő felhasználót:
                  <strong className="block text-foreground mt-1 text-sm font-semibold">{deleteUserName}</strong>?
                </p>
                <p className="bg-destructive/5 text-destructive border border-destructive/10 p-3 rounded-lg text-xs leading-relaxed">
                  <strong>FIGYELEM:</strong> Ez a művelet visszavonhatatlan. A felhasználó minden jogosultsága és cégtagsága megsemmisül, a fiókja véglegesen letiltásra kerül. A korábbi naplókban és adatokban a neve helyén <em>"Törölt Felhasználó"</em> fog szerepelni.
                </p>
                <p className="text-xs text-muted-foreground">
                  Ha a felhasználó egyedüli tulajdonosa egy cégnek, a törlést a rendszer biztonsági okokból megtagadja, amíg a tulajdonjogot át nem ruházod egy másik tagra.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel disabled={isDeleting}>Mégsem</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="gap-2"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isDeleting ? 'Törlés...' : 'Törlés és anonimizálás'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
