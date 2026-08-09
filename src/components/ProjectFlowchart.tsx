import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjectLaborDetails, LaborDetailRow } from '@/hooks/useProjectLaborDetails';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  FileText,
  Users,
  Receipt,
  FolderOpen,
  TrendingUp,
  BadgeDollarSign,
  Info,
  Globe,
  Smartphone,
  BarChart3,
  TrendingDown,
  Check,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Re-declare local types or import if exported
export interface Project {
  id?: string;
  name: string;
  description: string;
  client_name: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  budget?: number;
  start_date?: string;
  end_date?: string;
  project_code?: string;
  project_type: 'one_time' | 'recurring';
  icon?: string | null;
  color?: string | null;
}

interface ProjectFlowchartProps {
  project: Project;
  onBack: () => void;
}

export function ProjectFlowchart({ project, onBack }: ProjectFlowchartProps) {
  const [activeNode, setActiveNode] = useState<string>('node-invoices');
  const [paths, setPaths] = useState<{ d: string; color: string; dotColor: string; key: string }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Element Refs for SVG connections
  const nodeRefs = {
    invoices: useRef<HTMLDivElement>(null),
    labor: useRef<HTMLDivElement>(null),
    otherCosts: useRef<HTMLDivElement>(null),
    project: useRef<HTMLDivElement>(null),
    revenue: useRef<HTMLDivElement>(null),
    profit: useRef<HTMLDivElement>(null)
  };

  // 1. Fetch Exchange Rates
  const { data: exchangeRates = { HUF: 1 } } = useQuery({
    queryKey: ['daily-exchange-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_exchange_rates')
        .select('currency, rate')
        .order('rate_date', { ascending: false });

      if (error) throw error;
      
      const latestRates: Record<string, number> = { HUF: 1 };
      (data || []).forEach(row => {
        if (row.currency && !latestRates[row.currency.toUpperCase()]) {
          latestRates[row.currency.toUpperCase()] = Number(row.rate) || 1;
        }
      });
      return latestRates;
    }
  });

  // Currency Converter helper
  const convertToHuf = (amount: number, currency: string | null | undefined) => {
    const curr = (currency || 'HUF').toUpperCase();
    if (curr === 'HUF') return amount;
    const rate = exchangeRates[curr];
    if (rate) return amount * rate;
    return amount; // Fallback
  };

  // 2. Fetch assigned submitted invoices (for deduplication / physical receipt matching)
  const { data: submittedInvoices = [] } = useQuery({
    queryKey: ['assigned-submitted-invoices', project.id],
    queryFn: async () => {
      if (!project.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, elado_nev, vevo_nev, brutto_vegosszeg, penznem, kibocsatas_datuma, invoice_direction')
        .eq('project_id', project.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!project.id
  });

  // 3. Fetch assigned NAV invoices
  const { data: navInvoices = [] } = useQuery({
    queryKey: ['assigned-nav-invoices', project.id],
    queryFn: async () => {
      if (!project.id) return [];
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, customer_name, invoice_gross_amount, invoice_direction, currency, invoice_issue_date')
        .eq('project_id', project.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!project.id
  });

  // 4. Fetch labor details
  const { laborDetails, isLoading: laborLoading } = useProjectLaborDetails(project.id);

  // 5. Deduplication and classification matching Option A
  // Deduplicate physical invoices by invoice number already present in NAV
  const navInvoiceNumbers = useMemo(() => {
    return new Set(navInvoices.map(inv => (inv.invoice_number || '').trim().toLowerCase()));
  }, [navInvoices]);

  const uniqueSubmittedInvoices = useMemo(() => {
    return submittedInvoices.filter(inv => {
      const num = (inv.bizonylatsorszam || '').trim().toLowerCase();
      return !navInvoiceNumbers.has(num);
    });
  }, [submittedInvoices, navInvoiceNumbers]);

  // Group Inbound / Outbound
  const inboundNavInvoices = useMemo(() => {
    return navInvoices.filter(inv => inv.invoice_direction === 'INBOUND');
  }, [navInvoices]);

  const outboundNavInvoices = useMemo(() => {
    return navInvoices.filter(inv => inv.invoice_direction === 'OUTBOUND');
  }, [navInvoices]);

  const inboundSubmittedInvoices = useMemo(() => {
    return uniqueSubmittedInvoices.filter(inv => inv.invoice_direction === 'INBOUND');
  }, [uniqueSubmittedInvoices]);

  const outboundSubmittedInvoices = useMemo(() => {
    return uniqueSubmittedInvoices.filter(inv => inv.invoice_direction === 'OUTBOUND');
  }, [uniqueSubmittedInvoices]);

  // Totals calculations (all converted to HUF)
  const navInboundHufSum = useMemo(() => {
    return inboundNavInvoices.reduce((sum, inv) => sum + convertToHuf(Number(inv.invoice_gross_amount) || 0, inv.currency), 0);
  }, [inboundNavInvoices, exchangeRates]);

  const submittedInboundHufSum = useMemo(() => {
    return inboundSubmittedInvoices.reduce((sum, inv) => sum + convertToHuf(Number(inv.brutto_vegosszeg) || 0, inv.penznem), 0);
  }, [inboundSubmittedInvoices, exchangeRates]);

  const laborHufSum = useMemo(() => {
    return laborDetails.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  }, [laborDetails]);

  const outboundHufSum = useMemo(() => {
    const navSum = outboundNavInvoices.reduce((sum, inv) => sum + convertToHuf(Number(inv.invoice_gross_amount) || 0, inv.currency), 0);
    const subSum = outboundSubmittedInvoices.reduce((sum, inv) => sum + convertToHuf(Number(inv.brutto_vegosszeg) || 0, inv.penznem), 0);
    return navSum + subSum;
  }, [outboundNavInvoices, outboundSubmittedInvoices, exchangeRates]);

  // Overall statistics
  const totalExpensesHuf = navInboundHufSum + laborHufSum + submittedInboundHufSum;
  const totalProfitHuf = outboundHufSum - totalExpensesHuf;
  const marginPercent = outboundHufSum > 0 ? ((totalProfitHuf / outboundHufSum) * 100).toFixed(1) : '0';

  // Budget calculations
  const budgetLimit = project.budget ? Number(project.budget) : 0;
  const budgetPercent = budgetLimit > 0 ? Math.min(Math.round((totalExpensesHuf / budgetLimit) * 100), 100) : 0;

  // Cashflow chart data calculations
  const cashflowData = useMemo(() => {
    const dataMap: Record<string, { inflow: number; outflow: number }> = {};

    const addValue = (dateStr: string | null | undefined, amount: number, type: 'inflow' | 'outflow') => {
      if (!dateStr) return;
      const month = dateStr.slice(0, 7); // "YYYY-MM"
      if (!dataMap[month]) {
        dataMap[month] = { inflow: 0, outflow: 0 };
      }
      dataMap[month][type] += amount;
    };

    // Add outbound NAV invoices
    outboundNavInvoices.forEach(inv => {
      addValue(inv.invoice_issue_date, convertToHuf(Number(inv.invoice_gross_amount) || 0, inv.currency), 'inflow');
    });

    // Add outbound submitted invoices
    outboundSubmittedInvoices.forEach(inv => {
      addValue(inv.kibocsatas_datuma, convertToHuf(Number(inv.brutto_vegosszeg) || 0, inv.penznem), 'inflow');
    });

    // Add inbound NAV invoices
    inboundNavInvoices.forEach(inv => {
      addValue(inv.invoice_issue_date, convertToHuf(Number(inv.invoice_gross_amount) || 0, inv.currency), 'outflow');
    });

    // Add inbound submitted invoices
    inboundSubmittedInvoices.forEach(inv => {
      addValue(inv.kibocsatas_datuma, convertToHuf(Number(inv.brutto_vegosszeg) || 0, inv.penznem), 'outflow');
    });

    // Add labor costs
    laborDetails.forEach(item => {
      addValue(item.date, item.total_cost || 0, 'outflow');
    });

    // Convert map to sorted array
    return Object.entries(dataMap)
      .map(([month, val]) => ({
        month,
        inflow: Math.round(val.inflow),
        outflow: Math.round(val.outflow),
        net: Math.round(val.inflow - val.outflow)
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [inboundNavInvoices, outboundNavInvoices, inboundSubmittedInvoices, outboundSubmittedInvoices, laborDetails, exchangeRates]);

  // Render SVG Paths
  const updatePaths = () => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const getCoords = (el: HTMLDivElement | null) => {
      if (!el) return { x: 0, y: 0, width: 0, height: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height
      };
    };

    const cProject = getCoords(nodeRefs.project.current);
    const cInvoices = getCoords(nodeRefs.invoices.current);
    const cLabor = getCoords(nodeRefs.labor.current);
    const cOtherCosts = getCoords(nodeRefs.otherCosts.current);
    const cRevenue = getCoords(nodeRefs.revenue.current);
    const cProfit = getCoords(nodeRefs.profit.current);

    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      setPaths([]);
      return;
    }

    const newPaths = [];

    // Left Columns -> Middle Node connections
    const leftNodes = [
      { coords: cInvoices, color: 'url(#grad-teal)', dotColor: '#14b8a6', key: 'invoices-project' },
      { coords: cLabor, color: 'url(#grad-purple)', dotColor: '#a855f7', key: 'labor-project' },
      { coords: cOtherCosts, color: 'url(#grad-red)', dotColor: '#ef4444', key: 'other-project' }
    ];

    leftNodes.forEach(node => {
      if (node.coords.width === 0) return;
      const startX = node.coords.x + node.coords.width;
      const startY = node.coords.y + node.coords.height / 2;
      const endX = cProject.x;
      const endY = cProject.y + cProject.height / 2;

      const controlX = startX + (endX - startX) / 2;
      const d = `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
      newPaths.push({ d, color: node.color, dotColor: node.dotColor, key: node.key });
    });

    // Middle Node -> Right Columns connections
    const rightNodes = [
      { coords: cRevenue, color: 'url(#grad-green)', dotColor: '#10b981', key: 'project-revenue' },
      { coords: cProfit, color: 'url(#grad-teal)', dotColor: '#14b8a6', key: 'project-profit' }
    ];

    rightNodes.forEach(node => {
      if (node.coords.width === 0) return;
      const startX = cProject.x + cProject.width;
      const startY = cProject.y + cProject.height / 2;
      const endX = node.coords.x;
      const endY = node.coords.y + node.coords.height / 2;

      const controlX = startX + (endX - startX) / 2;
      const d = `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
      newPaths.push({ d, color: node.color, dotColor: node.dotColor, key: node.key });
    });

    setPaths(newPaths);
  };

  useEffect(() => {
    // Delay to let UI layout settle
    const timer = setTimeout(() => {
      updatePaths();
    }, 150);

    window.addEventListener('resize', updatePaths);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePaths);
    };
  }, [project, inboundNavInvoices, laborDetails, uniqueSubmittedInvoices]);

  // Resolve project specific icon
  const getProjectIcon = () => {
    switch (project.icon) {
      case 'globe': return <Globe className="w-5 h-5" />;
      case 'smartphone': return <Smartphone className="w-5 h-5" />;
      case 'bar-chart-3': return <BarChart3 className="w-5 h-5" />;
      default: return <FolderOpen className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flow {
          to {
            stroke-dashoffset: -20;
          }
        }
      `}} />
      
      {/* View Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground border border-transparent transition-colors flex items-center justify-center"
            title="Vissza a projektekhez"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {project.name} Folyamatábra
            </h2>
            <p className="text-xs text-muted-foreground">Pénzügyi és bizonylat áramlási folyamat térképe</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground bg-secondary/80 px-2.5 py-1 rounded border border-border font-mono">
            {project.project_code || 'Kód nélkül'}
          </span>
        </div>
      </div>

      {/* Main Flowchart View Board */}
      <div
        ref={containerRef}
        className="relative min-h-[460px] border border-border bg-card/40 rounded-xl p-6 flex flex-col justify-between overflow-hidden"
      >
        
        {/* Dynamic connection lines SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="grad-teal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(20, 184, 166, 0.05)" />
              <stop offset="100%" stopColor="rgba(20, 184, 166, 0.4)" />
            </linearGradient>
            <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(168, 85, 247, 0.05)" />
              <stop offset="100%" stopColor="rgba(168, 85, 247, 0.4)" />
            </linearGradient>
            <linearGradient id="grad-green" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(20, 184, 166, 0.4)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0.4)" />
            </linearGradient>
            <linearGradient id="grad-red" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.05)" />
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.4)" />
            </linearGradient>
          </defs>
          
          {paths.map(path => (
            <React.Fragment key={path.key}>
              {/* Flow line path */}
              <path
                d={path.d}
                fill="none"
                stroke={path.color}
                strokeWidth="2"
                className="stroke-teal-500/30 opacity-60"
                style={{
                  strokeDasharray: '6, 4',
                  animation: 'flow 1.5s linear infinite',
                }}
              />
              {/* Flowing dot light */}
              <circle
                r="3.5"
                fill={path.dotColor}
              >
                <animateMotion
                  dur="4s"
                  repeatCount="indefinite"
                  path={path.d}
                />
              </circle>
            </React.Fragment>
          ))}
        </svg>

        {/* Board Title Area */}
        <div className="flex items-center justify-between z-10 select-none">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Projekt Folyamattérkép</h3>
            {project.client_name && (
              <p className="text-xs text-foreground/80 mt-0.5">Ügyfél: {project.client_name}</p>
            )}
          </div>
        </div>

        {/* 3-Column Nodes Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16 items-center my-auto z-10 w-full relative">
          
          {/* Column 1: Sources / Inputs */}
          <div className="space-y-4 flex flex-col justify-center">
            
            {/* Inbound NAV Invoices Node */}
            <div
              ref={nodeRefs.invoices}
              onClick={() => setActiveNode('node-invoices')}
              className={`p-3.5 rounded-lg border bg-card cursor-pointer select-none transition-all duration-200 flex items-center gap-3 ${
                activeNode === 'node-invoices'
                  ? 'border-primary shadow-[0_0_15px_rgba(20,184,166,0.15)] translate-x-1'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
                <FileText className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">NAV Bejövő Számlák</div>
                <div className="text-sm font-bold text-foreground truncate">{formatCurrency(navInboundHufSum, 'HUF')}</div>
                <div className="text-[10px] text-muted-foreground">{inboundNavInvoices.length} db számla</div>
              </div>
            </div>

            {/* Labor / Time logs Node */}
            <div
              ref={nodeRefs.labor}
              onClick={() => setActiveNode('node-labor')}
              className={`p-3.5 rounded-lg border bg-card cursor-pointer select-none transition-all duration-200 flex items-center gap-3 ${
                activeNode === 'node-labor'
                  ? 'border-primary shadow-[0_0_15px_rgba(20,184,166,0.15)] translate-x-1'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <span className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                <Users className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Munkadíj / Bérköltség</div>
                <div className="text-sm font-bold text-foreground truncate">{formatCurrency(laborHufSum, 'HUF')}</div>
                <div className="text-[10px] text-muted-foreground">
                  {laborDetails.reduce((sum, i) => sum + i.hours, 0)} óra ({new Set(laborDetails.map(i => i.user_id)).size} fő)
                </div>
              </div>
            </div>

            {/* Other / manual costs Node */}
            <div
              ref={nodeRefs.otherCosts}
              onClick={() => setActiveNode('node-other-costs')}
              className={`p-3.5 rounded-lg border bg-card cursor-pointer select-none transition-all duration-200 flex items-center gap-3 ${
                activeNode === 'node-other-costs'
                  ? 'border-primary shadow-[0_0_15px_rgba(20,184,166,0.15)] translate-x-1'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <span className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20 shrink-0">
                <Receipt className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Feltöltött bizonylatok</div>
                <div className="text-sm font-bold text-foreground truncate">{formatCurrency(submittedInboundHufSum, 'HUF')}</div>
                <div className="text-[10px] text-muted-foreground">{inboundSubmittedInvoices.length} db manuális</div>
              </div>
            </div>

          </div>

          {/* Column 2: Central project Node */}
          <div className="flex justify-center">
            <div
              ref={nodeRefs.project}
              onClick={() => setActiveNode('node-project')}
              className={`p-4 rounded-xl border bg-card cursor-pointer select-none transition-all duration-200 flex flex-col items-center text-center w-56 relative overflow-hidden ${
                activeNode === 'node-project'
                  ? 'border-primary shadow-[0_0_20px_rgba(20,184,166,0.2)]'
                  : 'border-primary/40 hover:border-primary/70'
              }`}
            >
              <div
                className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-emerald-500"
                style={{ animation: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
              ></div>
              
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center border mb-2 mt-1"
                style={{
                  backgroundColor: (project.color || 'hsl(170, 82%, 45%)') + '15',
                  borderColor: (project.color || 'hsl(170, 82%, 45%)') + '30',
                  color: project.color || 'hsl(170, 82%, 45%)'
                }}
              >
                {getProjectIcon()}
              </span>

              <h4 className="font-bold text-sm text-foreground truncate max-w-full px-1">{project.name}</h4>
              {project.client_name && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-full">
                  {project.client_name}
                </p>
              )}

              {/* Progress bar */}
              <div className="w-full mt-3 space-y-1 text-left">
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Költségfelhasználás:</span>
                  <span className="font-bold text-foreground">{budgetLimit > 0 ? `${budgetPercent}%` : 'N/A'}</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden border border-border">
                  <div
                    className={`h-full transition-all duration-500 ${
                      budgetPercent > 90 ? 'bg-destructive' : budgetPercent > 70 ? 'bg-yellow-500' : 'bg-primary'
                    }`}
                    style={{ width: `${budgetLimit > 0 ? budgetPercent : 0}%` }}
                  ></div>
                </div>
                <div className="text-[9px] text-muted-foreground mt-1 flex justify-between font-mono">
                  <span>{formatCurrency(totalExpensesHuf, 'HUF')}</span>
                  <span className="text-muted-foreground/30">/</span>
                  <span>{budgetLimit > 0 ? formatCurrency(budgetLimit, 'HUF') : '∞'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Outputs / Results */}
          <div className="space-y-4 flex flex-col justify-center">
            
            {/* Outbound Invoices Node */}
            <div
              ref={nodeRefs.revenue}
              onClick={() => setActiveNode('node-revenue')}
              className={`p-3.5 rounded-lg border bg-card cursor-pointer select-none transition-all duration-200 flex items-center gap-3 ${
                activeNode === 'node-revenue'
                  ? 'border-primary shadow-[0_0_15px_rgba(20,184,166,0.15)] -translate-x-1'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kimenő Számlák (Bevétel)</div>
                <div className="text-sm font-bold text-emerald-400 truncate">{formatCurrency(outboundHufSum, 'HUF')}</div>
                <div className="text-[10px] text-muted-foreground">
                  {outboundNavInvoices.length + outboundSubmittedInvoices.length} db számla
                </div>
              </div>
            </div>

            {/* Profit Node */}
            <div
              ref={nodeRefs.profit}
              onClick={() => setActiveNode('node-profit')}
              className={`p-3.5 rounded-lg border bg-card cursor-pointer select-none transition-all duration-200 flex items-center gap-3 ${
                activeNode === 'node-profit'
                  ? 'border-primary shadow-[0_0_15px_rgba(20,184,166,0.15)] -translate-x-1'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                <BadgeDollarSign className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Projekt Eredmény (Profit)</div>
                <div className={`text-sm font-bold truncate ${totalProfitHuf >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {totalProfitHuf >= 0 ? '+' : ''}{formatCurrency(totalProfitHuf, 'HUF')}
                </div>
                <div className="text-[10px] text-muted-foreground">{marginPercent}% árrés</div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer Area inside board */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-3 z-10 shrink-0 mt-4 select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500"></span> Költség bizonylat</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-500"></span> Bérköltség</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500"></span> Bevétel számla</span>
          </div>
          <span>Kattints a folyamatábra elemeire a részletekért!</span>
        </div>

      </div>

      {/* Cashflow Chart Section */}
      <Card className="border border-border bg-card/20 overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h4 className="font-bold text-sm text-foreground">Havi Cashflow Kimutatás</h4>
              <p className="text-[10px] text-muted-foreground">Projektre realizált havi bevételek és ráfordítások alakulása (HUF)</p>
            </div>
            {/* Legend indicators */}
            <div className="flex items-center gap-3 text-[10px] font-semibold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Bevétel</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500"></span> Kiadás</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-teal-500"></span> Nettó</span>
            </div>
          </div>
          
          <div className="h-64 w-full">
            {cashflowData.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                Nincs elegendő adat a Cashflow diagram kirajzolásához.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflowData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCurrency(value, 'HUF').replace(' Ft', '')}
                  />
                  <RechartsTooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelClassName="text-xs font-bold text-foreground font-mono"
                    itemStyle={{ fontSize: '11px' }}
                    formatter={(value: any, name: any) => {
                      const label = name === 'inflow' ? 'Bevétel' : name === 'outflow' ? 'Kiadás' : 'Nettó';
                      return [formatCurrency(Number(value), 'HUF'), label];
                    }}
                  />
                  <Area type="monotone" dataKey="inflow" stroke="#10b981" fillOpacity={1} fill="url(#colorInflow)" strokeWidth={2} name="inflow" />
                  <Area type="monotone" dataKey="outflow" stroke="#ef4444" fillOpacity={1} fill="url(#colorOutflow)" strokeWidth={2} name="outflow" />
                  <Area type="monotone" dataKey="net" stroke="#14b8a6" fill="none" strokeWidth={2} strokeDasharray="4 4" name="net" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details Table Panel at Bottom */}
      <div className="p-5 rounded-xl border border-border bg-card/20 flex flex-col gap-4 min-h-[220px]">
        {/* Node detail header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-md flex items-center justify-center ${
              activeNode === 'node-invoices' ? 'bg-blue-500/10 text-blue-400' :
              activeNode === 'node-labor' ? 'bg-purple-500/10 text-purple-400' :
              activeNode === 'node-other-costs' ? 'bg-red-500/10 text-red-400' :
              activeNode === 'node-project' ? 'bg-teal-500/10 text-teal-400' :
              activeNode === 'node-revenue' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary'
            }`}>
              {activeNode === 'node-invoices' && <FileText className="w-3.5 h-3.5" />}
              {activeNode === 'node-labor' && <Users className="w-3.5 h-3.5" />}
              {activeNode === 'node-other-costs' && <Receipt className="w-3.5 h-3.5" />}
              {activeNode === 'node-project' && getProjectIcon()}
              {activeNode === 'node-revenue' && <TrendingUp className="w-3.5 h-3.5" />}
              {activeNode === 'node-profit' && <BadgeDollarSign className="w-3.5 h-3.5" />}
            </span>
            <div>
              <h4 className="font-bold text-sm text-foreground">
                {activeNode === 'node-invoices' && 'NAV Bejövő Számlák részletezése'}
                {activeNode === 'node-labor' && 'Munkadíj & Munkaórák részletezése'}
                {activeNode === 'node-other-costs' && 'Egyéb feltöltött bizonylatok'}
                {activeNode === 'node-project' && `Projekt adatok: ${project.name}`}
                {activeNode === 'node-revenue' && 'Kimenő Számlák (Projekt bevételek)'}
                {activeNode === 'node-profit' && 'Projekt Eredmény & Profitabilitás'}
              </h4>
              <p className="text-[10px] text-muted-foreground">
                {activeNode === 'node-invoices' && 'A projekthez párosított és szinkronizált NAV bejövő bizonylatok.'}
                {activeNode === 'node-labor' && 'Munkaidő és óradíjak alapján számított bérköltségek.'}
                {activeNode === 'node-other-costs' && 'Feltöltött PDF/kép bizonylatok, amik nincsenek a NAV Online rendszerében.'}
                {activeNode === 'node-project' && 'Költségkeret és projekt-szintű statisztikák összefoglalója.'}
                {activeNode === 'node-revenue' && 'Vevők részére kiállított kimenő számlák.'}
                {activeNode === 'node-profit' && 'Bevételek csökkentve az összes bejövő és bérköltséggel.'}
              </p>
            </div>
          </div>
          
          <span className="text-xs font-semibold px-2.5 py-1 bg-secondary rounded-lg text-secondary-foreground font-mono">
            {activeNode === 'node-invoices' && `Összesen: ${formatCurrency(navInboundHufSum, 'HUF')}`}
            {activeNode === 'node-labor' && `Összesen: ${formatCurrency(laborHufSum, 'HUF')}`}
            {activeNode === 'node-other-costs' && `Összesen: ${formatCurrency(submittedInboundHufSum, 'HUF')}`}
            {activeNode === 'node-project' && `Budget limit: ${project.budget ? formatCurrency(Number(project.budget), 'HUF') : 'Nincs megadva'}`}
            {activeNode === 'node-revenue' && `Összesen: ${formatCurrency(outboundHufSum, 'HUF')}`}
            {activeNode === 'node-profit' && `Profit árrés: ${marginPercent}%`}
          </span>
        </div>

        {/* Content Box */}
        <div className="overflow-x-auto min-w-0">
          
          {/* Node: Inbound Invoices */}
          {activeNode === 'node-invoices' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3">Számlaszám</TableHead>
                  <TableHead className="py-2.5 px-3">Partner</TableHead>
                  <TableHead className="py-2.5 px-3">Kelt</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">Eredeti összeg</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">HUF érték</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inboundNavInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Nincs hozzárendelt NAV bejövő számla.
                    </TableCell>
                  </TableRow>
                ) : (
                  inboundNavInvoices.map((item) => {
                    const originalAmount = Number(item.invoice_gross_amount) || 0;
                    const hufVal = convertToHuf(originalAmount, item.currency);
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/20">
                        <TableCell className="py-2 px-3 font-mono font-bold text-foreground">{item.invoice_number}</TableCell>
                        <TableCell className="py-2 px-3">{item.supplier_name}</TableCell>
                        <TableCell className="py-2 px-3">{item.invoice_issue_date}</TableCell>
                        <TableCell className="py-2 px-3 text-right text-muted-foreground">
                          {formatCurrency(originalAmount, item.currency || 'HUF')}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-bold text-foreground">
                          {formatCurrency(hufVal, 'HUF')}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}

          {/* Node: Labor Details */}
          {activeNode === 'node-labor' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3">Munkatárs</TableHead>
                  <TableHead className="py-2.5 px-3">Dátum</TableHead>
                  <TableHead className="py-2.5 px-3">Munkaidő</TableHead>
                  <TableHead className="py-2.5 px-3">Óradíj</TableHead>
                  <TableHead className="py-2.5 px-3">Leírás</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">Bérköltség</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laborDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      Nincs rögzített időbejegyzés ehhez a projekthez.
                    </TableCell>
                  </TableRow>
                ) : (
                  laborDetails.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/20">
                      <TableCell className="py-2 px-3 font-bold text-foreground">{item.employee_name}</TableCell>
                      <TableCell className="py-2 px-3">{item.date}</TableCell>
                      <TableCell className="py-2 px-3">{item.hours} óra</TableCell>
                      <TableCell className="py-2 px-3 text-muted-foreground">
                        {item.has_rate ? (
                          formatCurrency(item.hourly_rate || 0, 'HUF') + '/óra'
                        ) : (
                          <span className="text-destructive font-semibold text-[10px] bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20">
                            Nincs óradíj
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-[11px] max-w-[200px] truncate" title={item.description || ''}>
                        {item.description || '-'}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-right font-bold text-foreground">
                        {formatCurrency(item.total_cost, 'HUF')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Node: Other costs */}
          {activeNode === 'node-other-costs' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3">Bizonylatszám</TableHead>
                  <TableHead className="py-2.5 px-3">Partner</TableHead>
                  <TableHead className="py-2.5 px-3">Kelt</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">Eredeti összeg</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">HUF érték</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inboundSubmittedInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Nincs egyéb feltöltött költségbizonylat.
                    </TableCell>
                  </TableRow>
                ) : (
                  inboundSubmittedInvoices.map((item) => {
                    const originalAmount = Number(item.brutto_vegosszeg) || 0;
                    const hufVal = convertToHuf(originalAmount, item.penznem);
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/20">
                        <TableCell className="py-2 px-3 font-mono font-bold text-foreground">
                          {item.bizonylatsorszam || 'Bizonylat'}
                        </TableCell>
                        <TableCell className="py-2 px-3">{item.elado_nev}</TableCell>
                        <TableCell className="py-2 px-3">{item.kibocsatas_datuma}</TableCell>
                        <TableCell className="py-2 px-3 text-right text-muted-foreground">
                          {formatCurrency(originalAmount, item.penznem || 'HUF')}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-bold text-foreground">
                          {formatCurrency(hufVal, 'HUF')}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}

          {/* Node: Central Project */}
          {activeNode === 'node-project' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3">Pénzügyi mérőszám</TableHead>
                  <TableHead className="py-2.5 px-3">Összeg (HUF)</TableHead>
                  <TableHead className="py-2.5 px-3">Magyarázat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="hover:bg-muted/20">
                  <TableCell className="py-2 px-3 font-semibold text-foreground">Projekt Limit / Költségvetés</TableCell>
                  <TableCell className="py-2 px-3 font-bold">
                    {project.budget ? formatCurrency(budgetLimit, 'HUF') : 'Nincs limit megadva'}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-muted-foreground">A projektre tervezett maximális költségkeret.</TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/20">
                  <TableCell className="py-2 px-3 font-semibold text-foreground text-rose-400">NAV Bejövő Költségek</TableCell>
                  <TableCell className="py-2 px-3 font-bold text-rose-400">{formatCurrency(navInboundHufSum, 'HUF')}</TableCell>
                  <TableCell className="py-2 px-3 text-muted-foreground">A NAV-ból érkezett számlák összesített ára.</TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/20">
                  <TableCell className="py-2 px-3 font-semibold text-foreground text-rose-400">Bérköltségek (Munkadíjak)</TableCell>
                  <TableCell className="py-2 px-3 font-bold text-rose-400">{formatCurrency(laborHufSum, 'HUF')}</TableCell>
                  <TableCell className="py-2 px-3 text-muted-foreground">Munkatársak munkaórái megszorozva óradíjaikkal.</TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/20">
                  <TableCell className="py-2 px-3 font-semibold text-foreground text-rose-400">Egyéb manuális költségek</TableCell>
                  <TableCell className="py-2 px-3 font-bold text-rose-400">{formatCurrency(submittedInboundHufSum, 'HUF')}</TableCell>
                  <TableCell className="py-2 px-3 text-muted-foreground">Feltöltött PDF, készpénzes vagy egyéb devizás bizonylatok.</TableCell>
                </TableRow>
                <TableRow className="bg-secondary/40 font-bold">
                  <TableCell className="py-2.5 px-3 text-foreground">ÖSSZES RÁFORDÍTÁS</TableCell>
                  <TableCell className="py-2.5 px-3 text-rose-400">{formatCurrency(totalExpensesHuf, 'HUF')}</TableCell>
                  <TableCell className="py-2.5 px-3 text-muted-foreground">A projekt összesített felhasznált költsége.</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

          {/* Node: Revenue Invoices */}
          {activeNode === 'node-revenue' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3">Számlaszám</TableHead>
                  <TableHead className="py-2.5 px-3">Vevő</TableHead>
                  <TableHead className="py-2.5 px-3">Kelt</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">Eredeti összeg</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">HUF érték</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outboundNavInvoices.length === 0 && outboundSubmittedInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Nincs kiállított kimenő számla ehhez a projekthez.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {outboundNavInvoices.map((item) => {
                      const originalAmount = Number(item.invoice_gross_amount) || 0;
                      const hufVal = convertToHuf(originalAmount, item.currency);
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/20">
                          <TableCell className="py-2 px-3 font-mono font-bold text-foreground">{item.invoice_number}</TableCell>
                          <TableCell className="py-2 px-3">{item.customer_name}</TableCell>
                          <TableCell className="py-2 px-3">{item.invoice_issue_date}</TableCell>
                          <TableCell className="py-2 px-3 text-right text-muted-foreground">
                            {formatCurrency(originalAmount, item.currency || 'HUF')}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-right font-bold text-emerald-400">
                            {formatCurrency(hufVal, 'HUF')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {outboundSubmittedInvoices.map((item) => {
                      const originalAmount = Number(item.brutto_vegosszeg) || 0;
                      const hufVal = convertToHuf(originalAmount, item.penznem);
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/20">
                          <TableCell className="py-2 px-3 font-mono font-bold text-foreground">
                            {item.bizonylatsorszam || 'Bizonylat'}
                          </TableCell>
                          <TableCell className="py-2 px-3">{item.vevo_nev}</TableCell>
                          <TableCell className="py-2 px-3">{item.kibocsatas_datuma}</TableCell>
                          <TableCell className="py-2 px-3 text-right text-muted-foreground">
                            {formatCurrency(originalAmount, item.penznem || 'HUF')}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-right font-bold text-emerald-400">
                            {formatCurrency(hufVal, 'HUF')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                )}
              </TableBody>
            </Table>
          )}

          {/* Node: Profit & Loss matching mockup sheet */}
          {activeNode === 'node-profit' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2.5 px-3">Mérlegtétel megnevezése</TableHead>
                  <TableHead className="py-2.5 px-3">Művelet</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">Összeg (HUF)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="hover:bg-muted/20">
                  <TableCell className="py-2 px-3 font-semibold text-foreground">Kimenő Bevételek</TableCell>
                  <TableCell className="py-2 px-3 font-mono font-bold text-emerald-500">+</TableCell>
                  <TableCell className="py-2 px-3 text-right font-bold text-emerald-500">
                    {formatCurrency(outboundHufSum, 'HUF')}
                  </TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/20">
                  <TableCell className="py-2 px-3 font-semibold text-foreground">NAV Bejövő Költségek</TableCell>
                  <TableCell className="py-2 px-3 font-mono font-bold text-rose-500">-</TableCell>
                  <TableCell className="py-2 px-3 text-right font-bold text-rose-500">
                    {formatCurrency(navInboundHufSum, 'HUF')}
                  </TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/20">
                  <TableCell className="py-2 px-3 font-semibold text-foreground">Bérköltségek (Munkadíjak)</TableCell>
                  <TableCell className="py-2 px-3 font-mono font-bold text-rose-500">-</TableCell>
                  <TableCell className="py-2 px-3 text-right font-bold text-rose-500">
                    {formatCurrency(laborHufSum, 'HUF')}
                  </TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/20">
                  <TableCell className="py-2 px-3 font-semibold text-foreground">Egyéb Feltöltött Költségek</TableCell>
                  <TableCell className="py-2 px-3 font-mono font-bold text-rose-500">-</TableCell>
                  <TableCell className="py-2 px-3 text-right font-bold text-rose-500">
                    {formatCurrency(submittedInboundHufSum, 'HUF')}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-secondary/40 font-bold border-t border-border">
                  <TableCell className="py-3 px-3 text-foreground">PROJEKT PROFIT</TableCell>
                  <TableCell className="py-3 px-3 font-bold text-primary">=</TableCell>
                  <TableCell className="py-3 px-3 text-right text-primary text-sm font-black">
                    {formatCurrency(totalProfitHuf, 'HUF')}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

        </div>
      </div>

    </div>
  );
}
