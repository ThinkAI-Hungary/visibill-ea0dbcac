import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calculator,
  Plus,
  Edit2,
  Trash2,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  MapPin,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { OpgRegisterModal } from './OpgRegisterModal';
import type { OpgCashRegister, CreateOpgRegisterInput, UpdateOpgRegisterInput } from '@/types/opg';
import type { PettyCashRegister } from '@/components/petty-cash/types';

interface OpgRegistersTabProps {
  registers: OpgCashRegister[];
  pettyCashRegisters: PettyCashRegister[];
  companyId: string;
  isLoading?: boolean;
  onCreateRegister: (input: CreateOpgRegisterInput) => Promise<any>;
  onUpdateRegister: (input: UpdateOpgRegisterInput) => Promise<any>;
  onDeleteRegister: (id: string) => Promise<any>;
  onTestConnection: (id: string) => Promise<any>;
  onSeedDemoData?: () => Promise<any>;
  isTestingConnection?: boolean;
}

export const OpgRegistersTab: React.FC<OpgRegistersTabProps> = ({
  registers,
  pettyCashRegisters,
  companyId,
  isLoading = false,
  onCreateRegister,
  onUpdateRegister,
  onDeleteRegister,
  onTestConnection,
  onSeedDemoData,
  isTestingConnection = false,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRegister, setEditingRegister] = useState<OpgCashRegister | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleEdit = (reg: OpgCashRegister) => {
    setEditingRegister(reg);
    setModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingRegister(null);
    setModalOpen(true);
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await onTestConnection(id);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Biztosan törölni szeretné a(z) "${name}" nevű pénztárgépet?`)) {
      await onDeleteRegister(id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" /> Aktív
          </Badge>
        );
      case 'suspended':
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 gap-1 text-xs">
            <Clock className="h-3 w-3" /> Felfüggesztve
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1 text-xs">
            <AlertCircle className="h-3 w-3" /> Hiba
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            Lecsatlakozva
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Fejléc és Műveleti gombok */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Online Pénztárgépek listája</h3>
          <p className="text-sm text-muted-foreground">
            A céghez rendelt NAV online pénztárgépek (AP kódok) és házipénztári beállítások kezelése.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {registers.length === 0 && onSeedDemoData && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSeedDemoData}
              className="gap-1.5 border-dashed"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              Minta adatok generálása
            </Button>
          )}

          <Button onClick={handleAddNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Új pénztárgép rögzítése
          </Button>
        </div>
      </div>

      {/* Pénztárgépek táblázat / kártyák */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : registers.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calculator className="h-12 w-12 text-muted-foreground/60 mb-3" />
            <h4 className="text-base font-semibold">Még nincs rögzített online pénztárgép</h4>
            <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
              Rögzítse az üzletében vagy telephelyén üzemelő online pénztárgép AP kódját a NAV nyugtaforgalom és a házipénztári automatizmusok bekapcsolásához.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleAddNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Pénztárgép hozzáadása
              </Button>
              {onSeedDemoData && (
                <Button variant="outline" onClick={onSeedDemoData} className="gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Minta adatok betöltése
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[140px]">AP Kód</TableHead>
                <TableHead>Megnevezés & Helyszín</TableHead>
                <TableHead>Házipénztár rendelés</TableHead>
                <TableHead>Könyvelési mód</TableHead>
                <TableHead>Státusz</TableHead>
                <TableHead>Utolsó szinkron</TableHead>
                <TableHead className="text-right">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registers.map((reg) => {
                const assignedPcr = pettyCashRegisters.find(
                  (p) => p.id === reg.petty_cash_register_id
                );

                return (
                  <TableRow key={reg.id} className="hover:bg-muted/30 transition-colors">
                    {/* AP kód */}
                    <TableCell className="font-mono font-bold tracking-wider text-sm text-primary">
                      {reg.ap_code}
                    </TableCell>

                    {/* Megnevezés & Helyszín */}
                    <TableCell>
                      <div className="font-medium text-sm">{reg.name}</div>
                      {reg.location && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {reg.location}
                        </div>
                      )}
                    </TableCell>

                    {/* Házipénztár rendelés */}
                    <TableCell>
                      {assignedPcr ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                          <span>{assignedPcr.name}</span>
                          {assignedPcr.is_default && (
                            <span className="text-[10px] text-muted-foreground font-normal">
                              (Alap)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Cég alapértelmezett
                        </span>
                      )}
                    </TableCell>

                    {/* Könyvelési mód */}
                    <TableCell>
                      {reg.cash_booking_mode === 'daily_z_summary' ? (
                        <Badge variant="outline" className="text-xs font-normal bg-primary/5 text-primary border-primary/20">
                          Napi Z-összesítő
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs font-normal">
                          Tételes nyugta
                        </Badge>
                      )}
                    </TableCell>

                    {/* Státusz */}
                    <TableCell>{getStatusBadge(reg.status)}</TableCell>

                    {/* Utolsó szinkron */}
                    <TableCell className="text-xs text-muted-foreground">
                      {reg.last_successful_sync_at ? (
                        <div>
                          {new Date(reg.last_successful_sync_at).toLocaleDateString('hu-HU')}{' '}
                          {new Date(reg.last_successful_sync_at).toLocaleTimeString('hu-HU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      ) : (
                        <span className="italic">Még nem volt</span>
                      )}
                      {reg.last_error_message && (
                        <div className="text-[11px] text-destructive truncate max-w-[150px] mt-0.5">
                          {reg.last_error_message}
                        </div>
                      )}
                    </TableCell>

                    {/* Műveletek */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Kapcsolat tesztelése"
                          onClick={() => handleTest(reg.id)}
                          disabled={testingId === reg.id || isTestingConnection}
                        >
                          {testingId === reg.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Activity className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Szerkesztés"
                          onClick={() => handleEdit(reg)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Törlés"
                          onClick={() => handleDelete(reg.id, reg.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Szerkesztő / Létrehozó Modal */}
      <OpgRegisterModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        register={editingRegister}
        pettyCashRegisters={pettyCashRegisters}
        companyId={companyId}
        onSave={async (input) => {
          if ('id' in input && input.id) {
            await onUpdateRegister(input as UpdateOpgRegisterInput);
          } else {
            await onCreateRegister(input as CreateOpgRegisterInput);
          }
        }}
      />
    </div>
  );
};
