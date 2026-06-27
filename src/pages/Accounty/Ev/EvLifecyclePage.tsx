import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  GitBranch, ArrowLeft, ChevronRight, Plus, Calendar,
  Play, Pause, StopCircle, RefreshCw, ArrowRightLeft,
  CheckCircle2, Clock, AlertTriangle, FileText, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { useEvLifecycleEvents, type EvLifecycleEvent } from '@/hooks/useEvData';

// ─── Constants ──────────────────────────────────────────────────────────────

type EventType = 'start' | 'pause' | 'restart' | 'end' | 'form_change';

const EVENT_CONFIG: Record<EventType, { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
  start: { icon: <Play className="w-4 h-4" />, label: 'Tevékenység megkezdése', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  pause: { icon: <Pause className="w-4 h-4" />, label: 'Szüneteltetés', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  restart: { icon: <RefreshCw className="w-4 h-4" />, label: 'Újraindítás', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  end: { icon: <StopCircle className="w-4 h-4" />, label: 'Tevékenység megszüntetése', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  form_change: { icon: <ArrowRightLeft className="w-4 h-4" />, label: 'Adóforma-váltás', color: 'text-violet-600', bgColor: 'bg-violet-100 dark:bg-violet-900/30' },
};

const FORM_LABELS: Record<string, string> = {
  atalany: 'Átalányadó',
  vszja: 'Vállalkozói SZJA',
  kata: 'KATA',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvLifecyclePage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [showAddModal, setShowAddModal] = useState(false);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: rawEvents, isLoading } = useEvLifecycleEvents(id);

  const events = useMemo(() => {
    return (rawEvents || []).map((e: EvLifecycleEvent) => ({
      id: e.id,
      eventType: e.event_type as EventType,
      eventDate: e.event_date,
      fromForm: e.from_form,
      toForm: e.to_form,
      notes: e.notes,
      createdBy: '', // not stored in DB
    }));
  }, [rawEvents]);

  // Current status derived from latest event
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const isActive = latestEvent ? latestEvent.eventType !== 'end' && latestEvent.eventType !== 'pause' : false;
  const currentForm = events.filter(e => e.toForm).pop()?.toForm || 'atalany';
  const firstEvent = events.length > 0 ? events[0] : null;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Életciklus</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">EV Életciklus</h1>
            <p className="text-sm text-slate-500">{client?.name || 'Ügyfél'} – tevékenység története, adóforma-változások</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Új esemény
        </button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-soft p-12 text-center">
          <GitBranch className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Nincs még életciklus esemény rögzítve.</p>
          <p className="text-xs text-slate-400 mt-1">Kattintson az „Új esemény" gombra az első esemény rögzítéséhez.</p>
        </div>
      ) : (
        <>
          {/* Current status card */}
          <div className="bg-card rounded-xl border border-border shadow-soft p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Jelenlegi státusz</p>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold',
                    isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  )}>
                    {isActive ? <CheckCircle2 className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {isActive ? 'Aktív' : 'Szünetel'}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Adóforma: <strong className="text-indigo-600">{FORM_LABELS[currentForm] || currentForm}</strong>
                  </span>
                </div>
              </div>
              {firstEvent && (
                <div className="text-right">
                  <p className="text-xs text-slate-500">Tevékenység kezdete</p>
                  <p className="text-sm font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {new Date(firstEvent.eventDate).toLocaleDateString('hu-HU')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {Math.round((Date.now() - new Date(firstEvent.eventDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} éve
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-4">
              {[...events].reverse().map((event, idx) => {
                const config = EVENT_CONFIG[event.eventType];
                if (!config) return null;
                return (
                  <div key={event.id} className="relative flex gap-4 items-start">
                    {/* Timeline dot */}
                    <div className={cn(
                      'relative z-10 flex items-center justify-center w-12 h-12 rounded-xl shrink-0',
                      config.bgColor
                    )}>
                      <span className={config.color}>{config.icon}</span>
                    </div>

                    {/* Content */}
                    <div className={cn(
                      'flex-1 bg-card rounded-xl border border-border shadow-soft p-4',
                      idx === 0 && 'ring-2 ring-indigo-500/20'
                    )}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={cn('text-sm font-semibold', config.color)}>
                            {config.label}
                          </p>
                          {event.eventType === 'form_change' && event.fromForm && event.toForm && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {FORM_LABELS[event.fromForm]}
                              </span>
                              <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
                                {FORM_LABELS[event.toForm]}
                              </span>
                            </div>
                          )}
                          {event.notes && (
                            <p className="text-xs text-slate-500 mt-2">{event.notes}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {new Date(event.eventDate).toLocaleDateString('hu-HU')}
                          </p>
                          {event.createdBy && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{event.createdBy}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Info card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Adóforma-váltás szabályai</p>
            <ul className="text-xs text-blue-600 dark:text-blue-400 mt-1 space-y-0.5 list-disc list-inside">
              <li>Átalányadó ↔ VSZJA: adóév január 1-jétől, előző év december 31-ig bejelentés</li>
              <li>KATA belépés: bármely hónap elsejétől, 15 napos bejelentési kötelezettség</li>
              <li>KATA kilépés: automatikus a jogszabályi feltételek megszűnésénél</li>
              <li>A rendszer automatikusan ellenőrzi az értékhatárokat és figyelmeztet a kötelező váltásra</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
