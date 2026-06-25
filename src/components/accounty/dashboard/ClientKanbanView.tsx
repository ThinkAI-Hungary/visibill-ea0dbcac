import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ClientData } from '@/pages/Accounty/types';
import { ClientCard } from './DashboardShared';

interface ClientKanbanViewProps {
  filteredClients: ClientData[];
  handleUpdateOwner: (clientId: string, ownerId: string) => void;
  onStatusChange: (clientId: string, newStatus: ClientData['status']) => void;
}

export default function ClientKanbanView({
  filteredClients,
  handleUpdateOwner,
  onStatusChange,
}: ClientKanbanViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ClientData['status'] | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('clientId', id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setDraggedId(id), 0);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: ClientData['status']) => {
    e.preventDefault();
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDrop = (e: React.DragEvent, newStatus: ClientData['status']) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggedId(null);
    
    const clientId = e.dataTransfer.getData('clientId');
    if (!clientId) return;
    
    onStatusChange(clientId, newStatus);
  };

  const columns: { status: ClientData['status']; label: string; colorClass: string; bgOverClass: string; dotColor: string }[] = [
    { 
      status: 'Feldolgozandó', 
      label: 'Feldolgozandó', 
      colorClass: 'bg-amber-50/80 border-amber-300 ring-4 ring-amber-500/10',
      bgOverClass: 'bg-amber-50/80 border-amber-300 ring-4 ring-amber-500/10',
      dotColor: 'bg-amber-500'
    },
    { 
      status: 'Rendben', 
      label: 'Rendben', 
      colorClass: 'bg-accent-subtle/80 border-primary/30 ring-4 ring-primary/10',
      bgOverClass: 'bg-accent-subtle/80 border-primary/30 ring-4 ring-primary/10',
      dotColor: 'bg-primary'
    },
    { 
      status: 'Kritikus', 
      label: 'Kritikus', 
      colorClass: 'bg-red-50/80 border-red-300 ring-4 ring-red-500/10',
      bgOverClass: 'bg-red-50/80 border-red-300 ring-4 ring-red-500/10',
      dotColor: 'bg-red-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {columns.map((col) => {
        const columnClients = filteredClients.filter(c => c.status === col.status);
        const isOver = dragOverColumn === col.status;
        
        return (
          <div 
            key={col.status}
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-4 min-h-[500px] transition-all duration-200",
              isOver ? col.bgOverClass : "bg-slate-100/60 dark:bg-slate-900/60 border-border/60"
            )}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className={cn("w-2.5 h-2.5 rounded-full", col.dotColor)}></span>
                {col.label}
              </h3>
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {columnClients.length}
              </span>
            </div>
            
            {columnClients.map(client => (
              <ClientCard 
                key={client.id} 
                client={client} 
                draggable 
                isDragged={draggedId === client.id}
                onDragStart={(e) => handleDragStart(e, client.id)} 
                onDragEnd={handleDragEnd}
                onUpdateOwner={handleUpdateOwner}
              />
            ))}
            
            {columnClients.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-border rounded-lg">
                Nincs ügyfél
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
