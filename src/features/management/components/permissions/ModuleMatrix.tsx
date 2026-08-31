import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Eye, Pencil, RotateCcw, Search, X } from 'lucide-react';
import { PLATFORM_MODULE_GROUPS, MODULE_LABELS } from './PermissionConstants';

interface ModuleMatrixProps {
  title: string;
  subtitle: string;
  platform: string;
  entityId: string;
  modules: Array<{ module: string; canRead: boolean; canWrite: boolean; isOverride: boolean }>;
  getEffectiveValue: (platform: string, entityId: string, module: string, field: 'canRead' | 'canWrite', original: boolean) => boolean;
  isChanged: (platform: string, entityId: string, module: string, field: 'canRead' | 'canWrite', original: boolean) => boolean;
  onToggle: (platform: string, entityId: string, module: string, field: 'canRead' | 'canWrite', current: boolean) => void;
}

export function ModuleMatrix({
  title,
  subtitle,
  platform,
  entityId,
  modules,
  getEffectiveValue,
  isChanged,
  onToggle,
}: ModuleMatrixProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return modules;
    const q = searchQuery.toLowerCase();
    const groupInfo = PLATFORM_MODULE_GROUPS[platform] || {};
    return modules.filter(mod => {
      const info = groupInfo[mod.module];
      const label = info?.label || MODULE_LABELS[mod.module] || mod.module;
      return label.toLowerCase().includes(q) || mod.module.toLowerCase().includes(q);
    });
  }, [modules, searchQuery, platform]);

  const groupedModules = useMemo(() => {
    const groups: Record<string, typeof modules> = {};
    const groupInfo = PLATFORM_MODULE_GROUPS[platform] || {};
    
    filteredModules.forEach(mod => {
      const info = groupInfo[mod.module];
      const groupName = info?.group || 'Egyéb';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(mod);
    });
    
    return groups;
  }, [filteredModules, platform]);

  const handleBulkToggleGroup = (groupName: string, field: 'canRead' | 'canWrite', enable: boolean) => {
    const groupInfo = PLATFORM_MODULE_GROUPS[platform] || {};
    const groupMods = modules.filter(mod => {
      const info = groupInfo[mod.module];
      return (info?.group || 'Egyéb') === groupName;
    });

    groupMods.forEach(mod => {
      const currentEffective = getEffectiveValue(platform, entityId, mod.module, field, mod[field]);
      
      if (field === 'canWrite' && enable) {
        const currentRead = getEffectiveValue(platform, entityId, mod.module, 'canRead', mod.canRead);
        if (!currentRead) {
          onToggle(platform, entityId, mod.module, 'canRead', false);
        }
      }
      
      if (field === 'canRead' && !enable) {
        const currentWrite = getEffectiveValue(platform, entityId, mod.module, 'canWrite', mod.canWrite);
        if (currentWrite) {
          onToggle(platform, entityId, mod.module, 'canWrite', true);
        }
      }

      if (currentEffective !== enable) {
        onToggle(platform, entityId, mod.module, field, currentEffective);
      }
    });
  };

  const handleResetGroup = (groupName: string) => {
    const groupInfo = PLATFORM_MODULE_GROUPS[platform] || {};
    const groupMods = modules.filter(mod => {
      const info = groupInfo[mod.module];
      return (info?.group || 'Egyéb') === groupName;
    });

    groupMods.forEach(mod => {
      const currentRead = getEffectiveValue(platform, entityId, mod.module, 'canRead', mod.canRead);
      if (currentRead !== mod.canRead) {
        onToggle(platform, entityId, mod.module, 'canRead', currentRead);
      }
      const currentWrite = getEffectiveValue(platform, entityId, mod.module, 'canWrite', mod.canWrite);
      if (currentWrite !== mod.canWrite) {
        onToggle(platform, entityId, mod.module, 'canWrite', currentWrite);
      }
    });
  };

  return (
    <Card className="border border-border/80 shadow-md">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Modul szűrése..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background/50"
              aria-label="Modul szűrése"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                aria-label="Keresés törlése"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground bg-muted/5">
                <th className="text-left py-2.5 px-4 font-medium">Modul</th>
                <th className="text-center py-2.5 px-3 font-medium w-24">Olvasás</th>
                <th className="text-center py-2.5 px-3 font-medium w-24">Írás</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(groupedModules).length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nincs a szűrésnek megfelelő modul.
                  </td>
                </tr>
              )}
              {Object.entries(groupedModules).map(([groupName, groupMods]) => (
                <React.Fragment key={groupName}>
                  <tr className="border-b border-border/20 bg-muted/20">
                    <td className="py-1.5 px-4 font-bold text-[10px] text-primary uppercase tracking-wider">
                      {groupName}
                    </td>
                    <td colSpan={2} className="py-1 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleBulkToggleGroup(groupName, 'canRead', true)}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                          title="Összes olvasása engedélyezve a csoportban"
                        >
                          R+
                        </button>
                        <span className="text-muted-foreground/20 text-[9px]">|</span>
                        <button
                          onClick={() => handleBulkToggleGroup(groupName, 'canWrite', true)}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                          title="Összes írása engedélyezve a csoportban"
                        >
                          W+
                        </button>
                        <span className="text-muted-foreground/20 text-[9px]">|</span>
                        <button
                          onClick={() => {
                            handleBulkToggleGroup(groupName, 'canRead', false);
                            handleBulkToggleGroup(groupName, 'canWrite', false);
                          }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Összes letiltása a csoportban"
                        >
                          Tilt
                        </button>
                        <span className="text-muted-foreground/20 text-[9px]">|</span>
                        <button
                          onClick={() => handleResetGroup(groupName)}
                          className="p-1 rounded text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors"
                          title="Csoport visszaállítása alapértelmezettre"
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {groupMods.map(mod => {
                    const effectiveRead = getEffectiveValue(platform, entityId, mod.module, 'canRead', mod.canRead);
                    const effectiveWrite = getEffectiveValue(platform, entityId, mod.module, 'canWrite', mod.canWrite);
                    const readChanged = isChanged(platform, entityId, mod.module, 'canRead', mod.canRead);
                    const writeChanged = isChanged(platform, entityId, mod.module, 'canWrite', mod.canWrite);
                    const groupInfo = PLATFORM_MODULE_GROUPS[platform] || {};
                    const label = groupInfo[mod.module]?.label || MODULE_LABELS[mod.module] || mod.module;

                    return (
                      <tr key={mod.module} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-4 font-medium">
                          <span className="flex items-center gap-2">
                            {label}
                            {mod.isOverride && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-primary border-primary/30 bg-primary/5">
                                egyedi
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="text-center py-2 px-3">
                          <button
                            onClick={() => onToggle(platform, entityId, mod.module, 'canRead', effectiveRead)}
                            className={`h-6 w-7 rounded-md border flex items-center justify-center mx-auto transition-all duration-150
                              ${effectiveRead
                                ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                                : 'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted/60'
                              }
                              ${readChanged ? 'ring-2 ring-warning/60 border-warning' : ''}
                            `}
                            title={effectiveRead ? 'Olvasás: Engedélyezve' : 'Olvasás: Letiltva'}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        <td className="text-center py-2 px-3">
                          <button
                            onClick={() => onToggle(platform, entityId, mod.module, 'canWrite', effectiveWrite)}
                            className={`h-6 w-7 rounded-md border flex items-center justify-center mx-auto transition-all duration-150
                              ${effectiveWrite
                                ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                                : 'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted/60'
                              }
                              ${writeChanged ? 'ring-2 ring-warning/60 border-warning' : ''}
                            `}
                            title={effectiveWrite ? 'Írás: Engedélyezve' : 'Írás: Letiltva'}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
