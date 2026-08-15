import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SankeyNode {
  id: string;
  label: string;
  value: number;
  col: number;
  color: string;
}

interface SankeyLink {
  path: string;
  color: string;
  value: number;
  label: string;
  gradientId: string;
}

interface PnlSankeyChartProps {
  revenue: number;
  otherIncome: number;
  materials: number;
  personnel: number;
  depreciation: number;
  otherExpenses: number;
  taxes: number;
  netProfit: number;
  inThousands: boolean;
}

export function PnlSankeyChart({
  revenue,
  otherIncome,
  materials,
  personnel,
  depreciation,
  otherExpenses,
  taxes,
  netProfit,
  inThousands,
}: PnlSankeyChartProps) {
  const formatVal = (v: number) => {
    return new Intl.NumberFormat('hu-HU', {
      maximumFractionDigits: 0,
    }).format(Math.round(v)) + (inThousands ? ' E Ft' : ' Ft');
  };

  const chartData = useMemo(() => {
    // Avoid division by zero
    const safeRev = Math.max(0, revenue);
    const safeOthInc = Math.max(0, otherIncome);
    const totalInflow = safeRev + safeOthInc;

    if (totalInflow <= 0) return null;

    const safeMat = Math.max(0, materials);
    const safePers = Math.max(0, personnel);
    const safeDepr = Math.max(0, depreciation);
    const safeOthExp = Math.max(0, otherExpenses);
    const safeTax = Math.max(0, taxes);
    const safeProfit = Math.max(0, netProfit);

    // Node heights proportional to values
    const chartHeight = 240;
    const padding = 15;
    const colWidth = 110;
    const nodeWidth = 20;
    const leftMargin = 130; // Shift to the right to leave space for right-aligned Column 0 labels

    // Node definitions
    const nodes: SankeyNode[] = [
      // Column 0: Sources
      { id: 'revenue', label: 'Árbevétel', value: safeRev, col: 0, color: '#10b981' },
      { id: 'othIncome', label: 'Egyéb bevételek', value: safeOthInc, col: 0, color: '#34d399' },
      // Column 1: Middle
      { id: 'totalInflow', label: 'Összes Bevétel', value: totalInflow, col: 1, color: '#6366f1' },
      // Column 2: Destinations
      { id: 'materials', label: 'Anyagjellegű', value: safeMat, col: 2, color: '#f59e0b' },
      { id: 'personnel', label: 'Személyi jellegű', value: safePers, col: 2, color: '#f97316' },
      { id: 'overhead', label: 'Költségek & ÉCS', value: safeDepr + safeOthExp, col: 2, color: '#ef4444' },
      { id: 'taxes', label: 'Adók', value: safeTax, col: 2, color: '#ec4899' },
      { id: 'profit', label: 'Adózott eredmény', value: safeProfit, col: 2, color: '#3b82f6' },
    ];

    // Compute Y positions for each column
    const columns: Record<number, typeof nodes> = { 0: [], 1: [], 2: [] };
    nodes.forEach(n => columns[n.col].push(n));

    // Calculate scale (px per unit value)
    const colTotals = [
      safeRev + safeOthInc,
      totalInflow,
      safeMat + safePers + safeDepr + safeOthExp + safeTax + safeProfit
    ];
    const maxTotal = Math.max(...colTotals);
    const usableHeight = chartHeight - (5 * padding); // leave room for gaps
    const scale = maxTotal > 0 ? usableHeight / maxTotal : 0;

    const nodePositions: Record<string, { x: number; y: number; height: number }> = {};

    // Column 0 positioning
    let y0 = 10;
    columns[0].forEach(n => {
      const h = n.value * scale;
      nodePositions[n.id] = { x: leftMargin, y: y0, height: Math.max(4, h) };
      y0 += Math.max(4, h) + padding * 2.5;
    });

    // Column 1 positioning
    let y1 = 40;
    columns[1].forEach(n => {
      const h = n.value * scale;
      nodePositions[n.id] = { x: leftMargin + colWidth + nodeWidth, y: y1, height: Math.max(4, h) };
      y1 += Math.max(4, h) + padding;
    });

    // Column 2 positioning
    let y2 = 10;
    columns[2].forEach(n => {
      const h = n.value * scale;
      nodePositions[n.id] = { x: leftMargin + (colWidth + nodeWidth) * 2, y: y2, height: Math.max(4, h) };
      y2 += Math.max(4, h) + padding * 0.8;
    });

    // Links definitions and computing bezier paths
    const links: SankeyLink[] = [];

    // Left Column to Middle Node
    let sourceOffset0 = 0;
    columns[0].forEach(n => {
      const posSource = nodePositions[n.id];
      const posTarget = nodePositions['totalInflow'];
      const linkHeight = n.value * scale;

      const sy = posSource.y + linkHeight / 2;
      const ty = posTarget.y + sourceOffset0 + linkHeight / 2;

      const path = getBezierPath(
        posSource.x + nodeWidth, sy,
        posTarget.x, ty
      );

      links.push({
        path,
        color: n.color,
        value: n.value,
        label: `${n.label} ➔ ${formatVal(n.value)}`,
        gradientId: `grad-${n.id}`,
      });

      sourceOffset0 += linkHeight;
    });

    // Middle Node to Right Column
    let targetOffset = 0;
    columns[2].forEach(n => {
      const posSource = nodePositions['totalInflow'];
      const posTarget = nodePositions[n.id];
      const linkHeight = n.value * scale;

      const sy = posSource.y + targetOffset + linkHeight / 2;
      const ty = posTarget.y + linkHeight / 2;

      const path = getBezierPath(
        posSource.x + nodeWidth, sy,
        posTarget.x, ty
      );

      links.push({
        path,
        color: n.color,
        value: n.value,
        label: `${n.label} ➔ ${formatVal(n.value)}`,
        gradientId: `grad-${n.id}`,
      });

      targetOffset += linkHeight;
    });

    return {
      nodes,
      links,
      nodePositions,
      nodeWidth,
      chartHeight,
      scale,
    };
  }, [revenue, otherIncome, materials, personnel, depreciation, otherExpenses, taxes, netProfit, inThousands]);

  // Cubic Bezier curve path helper
  function getBezierPath(x0: number, y0: number, x1: number, y1: number) {
    const cx = (x0 + x1) / 2;
    return `M ${x0} ${y0} C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }

  if (!chartData) {
    return (
      <div className="flex justify-center items-center h-[240px] text-muted-foreground italic text-xs">
        Nincs elegendő pozitív bevételi adat a folyamatábra kirajzolásához.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-[600px] overflow-x-auto select-none p-1">
        <svg width="580" height={chartData.chartHeight} viewBox="0 0 580 240" className="overflow-visible font-sans">
          <defs>
            {/* Create soft gradients for the links */}
            {chartData.nodes.map((n) => (
              <linearGradient key={`grad-${n.id}`} id={`grad-${n.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={n.col === 0 ? n.color : '#6366f1'} stopOpacity="0.45" />
                <stop offset="100%" stopColor={n.col === 2 ? n.color : '#6366f1'} stopOpacity="0.45" />
              </linearGradient>
            ))}
          </defs>

          {/* Render Flow Connections (Links) */}
          <g>
            {chartData.links.map((link, idx) => (
              <g key={`link-${idx}`} className="group/link">
                <path
                  d={link.path}
                  fill="none"
                  stroke={`url(#${link.gradientId})`}
                  strokeWidth={Math.max(2, link.value * chartData.scale)}
                  className="hover:stroke-opacity-75 transition-all duration-200 cursor-pointer"
                />
                <title>{link.label}</title>
              </g>
            ))}
          </g>

          {/* Render Vertical Nodes */}
          <g>
            {chartData.nodes.map((node) => {
              const pos = chartData.nodePositions[node.id];
              if (!pos) return null;

              const isLeft = node.col === 0;
              const isRight = node.col === 2;

              return (
                <g key={node.id} className="group/node">
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={chartData.nodeWidth}
                    height={pos.height}
                    fill={node.color}
                    rx="3"
                    className="hover:opacity-85 transition-opacity cursor-pointer shadow-sm"
                  />
                  
                  {/* Labels positioning */}
                  <text
                    x={isLeft ? pos.x - 8 : isRight ? pos.x + chartData.nodeWidth + 8 : pos.x + chartData.nodeWidth / 2}
                    y={pos.y + pos.height / 2}
                    dy="3.5"
                    textAnchor={isLeft ? 'end' : isRight ? 'start' : 'middle'}
                    fill={node.col === 1 ? '#cbd5e1' : 'currentColor'}
                    fontSize={node.col === 1 ? '10px' : '11px'}
                    fontWeight={node.col === 1 ? 'bold' : '500'}
                    className={cn(
                      "fill-foreground pointer-events-none drop-shadow-sm",
                      node.col === 1 ? "hidden" : ""
                    )}
                  >
                    {node.label} ({formatVal(node.value)})
                  </text>
                  <title>{node.label}: {formatVal(node.value)}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="flex gap-4 mt-2 justify-center flex-wrap text-[10px] text-muted-foreground font-medium">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[#10b981]"></span>Bevételek</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[#f97316]"></span>Működési költségek</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[#ef4444]"></span>Egyéb overhead</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[#3b82f6]"></span>Adózott eredmény</span>
      </div>
    </div>
  );
}
