import React, { useState, useMemo, useCallback } from "react";
import { KnowledgeArticle } from "@/types/knowledgeBase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Compass,
  Link2,
  ShieldCheck,
  Zap,
  Target,
  CheckCircle2,
  Layers,
  MapPin,
  MousePointerClick,
  ListOrdered,
  ListTree,
  Copy,
  Check,
  ChevronRight,
  FolderKanban,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface SubFeature {
  subIndex: string;
  title: string;
  hogyHivjak: string;
  mireValo: string;
  holTalalhato: string;
  steps: string[];
  eredmeny: string;
}

export interface NavigationSpec {
  app?: string;
  group?: string;
  sidebarPosition?: string;
  route?: string;
  roles?: string;
  quickActions?: string;
  iconName?: string;
  otherDetails: string[];
}

export interface PurposeOverview {
  intro: string;
  tasks: Array<{ title: string; desc: string }>;
}

export interface TocItem {
  id: string;
  title: string;
  subIndex?: string;
  level: 2 | 3;
}

/**
 * Parses inline Markdown elements: **bold**, `inline code`, *italic*, [link](url)
 */
export function parseInlineFormatting(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  // Regex matching `code`, **bold**, *italic*, [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/;

  while (remaining.length > 0) {
    const match = remaining.match(regex);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    const before = remaining.slice(0, match.index);
    if (before) {
      parts.push(before);
    }

    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      const codeContent = token.slice(1, -1);
      parts.push(
        <code
          key={`code-${keyIndex++}`}
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-primary border border-border/50"
        >
          {codeContent}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      const boldContent = token.slice(2, -2);
      parts.push(
        <strong key={`bold-${keyIndex++}`} className="font-semibold text-foreground">
          {boldContent}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      const italicContent = token.slice(1, -1);
      parts.push(
        <em key={`italic-${keyIndex++}`} className="italic text-foreground/90">
          {italicContent}
        </em>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={`link-${keyIndex++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80 transition-colors"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    }

    remaining = remaining.slice(match.index + token.length);
  }

  return <>{parts}</>;
}

/**
 * Parses article markdown into semantic sections:
 * - Navigation spec (Section 1)
 * - Purpose and main tasks (Section 2)
 * - Sub-features with actions and steps (Section 3)
 */
export function parseArticleSections(markdown: string, fallbackMenuPath?: string) {
  const lines = markdown.split("\n");

  let app = "";
  let group = "";
  let rolesFromQuote = "";

  // Check top blockquote for app / menu group / roles
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const l = lines[i].trim();
    if (l.startsWith(">")) {
      if (/Alkalmaz\u00e1s/i.test(l)) {
        app = l.replace(/^>\s*\*\*Alkalmaz\u00e1s:\*\*\s*/i, "").trim();
      }
      if (/Men\u00fccsoport/i.test(l)) {
        group = l.replace(/^>\s*\*\*Men\u00fccsoport:\*\*\s*/i, "").trim();
      }
      if (/Szerepk\u00f6r/i.test(l)) {
        rolesFromQuote = l.replace(/^>\s*\*\*Sz\u00fcks\u00e9ges szerepk\u00f6r:\*\*\s*/i, "").trim();
      }
    }
  }

  let sec1Lines: string[] = [];
  let sec2Lines: string[] = [];
  let sec3Lines: string[] = [];
  let currentSec = 0;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("## 1.")) {
      currentSec = 1;
      continue;
    }
    if (l.startsWith("## 2.")) {
      currentSec = 2;
      continue;
    }
    if (l.startsWith("## 3.")) {
      currentSec = 3;
      continue;
    }
    if (currentSec === 3 && l.startsWith("## ") && !l.startsWith("## 3.")) {
      currentSec = 4;
    }

    if (currentSec === 1) sec1Lines.push(l);
    else if (currentSec === 2) sec2Lines.push(l);
    else if (currentSec === 3) sec3Lines.push(l);
  }

  // Parse Section 1: Navigation Spec
  const navSpec: NavigationSpec = {
    app,
    group,
    sidebarPosition: "",
    route: fallbackMenuPath || "",
    roles: rolesFromQuote,
    quickActions: "",
    iconName: "",
    otherDetails: [],
  };

  let inSidebarPosition = false;
  for (let idx = 0; idx < sec1Lines.length; idx++) {
    const l = sec1Lines[idx];
    const t = l.trim();
    if (!t || t === "---") {
      inSidebarPosition = false;
      continue;
    }

    if (/Oldals\u00e1v poz\u00edci\u00f3/i.test(t)) {
      const direct = t.replace(/^[-*]\s+\*\*Oldals\u00e1v poz\u00edci\u00f3:\*\*\s*/i, "").trim();
      if (direct) {
        navSpec.sidebarPosition = direct;
        inSidebarPosition = false;
      } else {
        inSidebarPosition = true;
      }
      continue;
    }

    if (inSidebarPosition) {
      if (t.startsWith("- ") || t.startsWith("* ")) {
        const item = t.replace(/^[-*]\s+/, "").trim();
        navSpec.sidebarPosition = navSpec.sidebarPosition
          ? `${navSpec.sidebarPosition} • ${item}`
          : item;
        continue;
      } else {
        inSidebarPosition = false;
      }
    }

    if (/Webc\u00edm/i.test(t)) {
      const routeMatch = t.match(/`([^`]+)`/);
      if (routeMatch) {
        navSpec.route = routeMatch[1];
      } else {
        navSpec.route = t.replace(/^[-*]\s+\*\*Webc\u00edm:\*\*\s*/i, "").trim();
      }
    } else if (!navSpec.route && /El\u00e9r\u00e9si \u00fatvonal/i.test(t)) {
      const routeMatch = t.match(/`([^`]+)`/);
      if (routeMatch) {
        navSpec.route = routeMatch[1];
      }
    } else if (/Jogosults\u00e1g|Szerepk\u00f6r/i.test(t)) {
      navSpec.roles = t.replace(/^[-*]\s+\*\*(Jogosults\u00e1g|Sz\u00fcks\u00e9ges szerepk\u00f6r):\*\*\s*/i, "").trim();
    } else if (/Gyorsm\u0171velet/i.test(t)) {
      navSpec.quickActions = t.replace(/^[-*]\s+\*\*Gyorsm\u0171veletek:\*\*\s*/i, "").trim();
    } else if (/Ikon:/i.test(t)) {
      navSpec.iconName = t.replace(/^[-*]\s+\*\*Ikon:\*\*\s*/i, "").trim();
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      navSpec.otherDetails.push(t.replace(/^[-*]\s+/, ""));
    }
  }

  // Fallback for sidebarPosition if empty
  if (!navSpec.sidebarPosition) {
    navSpec.sidebarPosition = navSpec.group
      ? `A(z) ${navSpec.group} menücsoportban található.`
      : "Fő navigációs menü";
  }

  // Parse Section 2: Purpose & Tasks
  let introParagraphs: string[] = [];
  let tasks: Array<{ title: string; desc: string }> = [];
  let inTasks = false;

  for (const l of sec2Lines) {
    const t = l.trim();
    if (!t || t === "---") continue;
    if (/^###\s+F\u0151 feladatai/i.test(t)) {
      inTasks = true;
      continue;
    }
    if (inTasks && (t.startsWith("- ") || t.startsWith("* "))) {
      const taskText = t.replace(/^[-*]\s+/, "");
      const m = taskText.match(/^\*\*([^*]+):\*\*\s*(.*)/);
      if (m) {
        tasks.push({ title: m[1].trim(), desc: m[2].trim() });
      } else {
        tasks.push({ title: "", desc: taskText });
      }
    } else if (!inTasks) {
      introParagraphs.push(t);
    }
  }

  const purposeOverview: PurposeOverview = {
    intro: introParagraphs.join("\n\n"),
    tasks,
  };

  // Parse Section 3: Sub-features
  const subFeatures: SubFeature[] = [];
  let currentSub: SubFeature | null = null;

  for (const line of sec3Lines) {
    if (line.startsWith("### 3.")) {
      if (currentSub) subFeatures.push(currentSub);
      const match = line.match(/^###\s+(3\.\d+)\s*(.*)/);
      currentSub = {
        subIndex: match ? match[1] : "3",
        title: match ? match[2].trim().replace(/^[\p{Emoji}\s]+/u, "") : line.replace(/^###\s+/, ""),
        hogyHivjak: "",
        mireValo: "",
        holTalalhato: "",
        steps: [],
        eredmeny: "",
      };
      continue;
    }

    if (!currentSub) continue;
    const trimL = line.trim();
    if (!trimL || trimL === "---") continue;

    if (/Hogy h\u00edvj\u00e1k/i.test(trimL)) {
      currentSub.hogyHivjak = trimL.replace(/^[-*]\s+\*\*Hogy h\u00edvj\u00e1k:\*\*\s*/i, "").trim();
    } else if (/Mire val\u00f3/i.test(trimL)) {
      currentSub.mireValo = trimL.replace(/^[-*]\s+\*\*Mire val\u00f3:\*\*\s*/i, "").trim();
    } else if (/Hol tal\u00e1lhat\u00f3/i.test(trimL)) {
      currentSub.holTalalhato = trimL.replace(/^[-*]\s+\*\*Hol tal\u00e1lhat\u00f3( a fel\u00fcleten)?:\*\*\s*/i, "").trim();
    } else if (/Eredm\u00e9ny/i.test(trimL)) {
      currentSub.eredmeny = trimL.replace(/^[-*0-9.]+\s+\*\*Eredm\u00e9ny:\*\*\s*/i, "").trim();
    } else if (/^\d+\.\s+/.test(trimL)) {
      currentSub.steps.push(trimL.replace(/^\d+\.\s+/, "").trim());
    }
  }
  if (currentSub) subFeatures.push(currentSub);

  // Generate Table of Contents items
  const toc: TocItem[] = [
    { id: "sec-navigation", title: "Elhelyezkedés és Navigáció", level: 2 },
    { id: "sec-purpose", title: "Funkció és Fő Feladatok", level: 2 },
  ];

  subFeatures.forEach((sub) => {
    const slug = `sec-${sub.subIndex.replace(".", "-")}`;
    toc.push({
      id: slug,
      title: sub.title,
      subIndex: sub.subIndex,
      level: 3,
    });
  });

  return {
    navSpec,
    purposeOverview,
    subFeatures,
    toc,
  };
}

/**
 * Gyors specifikációs kártya (1. Hol található?)
 */
export const NavigationSpecCard = React.memo(function NavigationSpecCard({
  spec,
  onJumpUrl,
}: {
  spec: NavigationSpec;
  onJumpUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyRoute = (routeText: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(routeText);
      setCopied(true);
      toast({
        title: "Útvonal másolva",
        description: `${routeText} a vágólapra került.`,
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section
      id="sec-navigation"
      className="rounded-2xl border border-border/80 bg-gradient-to-b from-card/90 to-card/60 p-5 sm:p-6 shadow-sm backdrop-blur-sm space-y-4 scroll-mt-28"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              1. Hol található? (Elhelyezkedés és Navigáció)
            </h2>
            <p className="text-xs text-muted-foreground">
              Közvetlen elérési útvonal, oldalsáv pozíció és hozzáférési jogosultságok
            </p>
          </div>
        </div>

        {onJumpUrl && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex rounded-xl gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
          >
            <a href={onJumpUrl}>
              <span>Megnyitás</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
        {/* Oldalsáv pozíció */}
        {spec.sidebarPosition && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-primary border border-border/50 mt-0.5">
              <FolderKanban className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Oldalsáv Helye
              </span>
              <p className="text-xs font-medium text-foreground leading-relaxed">
                {parseInlineFormatting(spec.sidebarPosition)}
              </p>
            </div>
          </div>
        )}

        {/* Webcím / Útvonal */}
        {spec.route && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-primary border border-border/50 mt-0.5">
              <Link2 className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Elérési Útvonal / Webcím
              </span>
              <div className="flex items-center gap-2">
                <code className="rounded-md bg-background px-2 py-0.5 font-mono text-[11px] text-primary border border-border/60 truncate max-w-[240px]">
                  {spec.route}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md hover:bg-card"
                  onClick={() => handleCopyRoute(spec.route!)}
                  title="Útvonal másolása"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Jogosultság */}
        {spec.roles && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-primary border border-border/50 mt-0.5">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Szükséges Jogosultság
              </span>
              <p className="text-xs font-medium text-foreground leading-relaxed">
                {parseInlineFormatting(spec.roles)}
              </p>
            </div>
          </div>
        )}

        {/* Gyorsműveletek */}
        {spec.quickActions && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-amber-500 border border-border/50 mt-0.5">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Gyorsműveletek a felületen
              </span>
              <p className="text-xs font-medium text-foreground leading-relaxed">
                {parseInlineFormatting(spec.quickActions)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* További részletek ha vannak */}
      {spec.otherDetails.length > 0 && (
        <div className="pt-2 border-t border-border/40">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {spec.otherDetails.map((detail, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>{parseInlineFormatting(detail)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
});

/**
 * 2. Szekció: A menü funkciója és célja kártya
 */
export const PurposeOverviewCard = React.memo(function PurposeOverviewCard({
  purpose,
}: {
  purpose: PurposeOverview;
}) {
  return (
    <section
      id="sec-purpose"
      className="rounded-2xl border border-border/80 bg-card/80 p-5 sm:p-6 shadow-sm backdrop-blur-sm space-y-5 scroll-mt-28"
    >
      <div className="flex items-center gap-2.5 border-b border-border/60 pb-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Target className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">
            2. A menü funkciója és célja
          </h2>
          <p className="text-xs text-muted-foreground">
            Üzleti célkitűzés és a modul alapvető számviteli/szervezési rendeltetése
          </p>
        </div>
      </div>

      {purpose.intro && (
        <div className="text-sm font-normal text-foreground/90 leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/40">
          {parseInlineFormatting(purpose.intro)}
        </div>
      )}

      {purpose.tasks.length > 0 && (
        <div className="space-y-3 pt-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <span>Fő feladatok és képességek:</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {purpose.tasks.map((task, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1.5 hover:border-primary/30 transition-colors"
              >
                {task.title && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <h4 className="text-xs font-bold text-foreground">
                      {task.title}
                    </h4>
                  </div>
                )}
                <p className="text-xs text-foreground/80 leading-relaxed pl-6">
                  {parseInlineFormatting(task.desc)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

/**
 * 3.x Al-funkció kártya (FeatureSectionCard)
 */
export const FeatureSectionCard = React.memo(function FeatureSectionCard({
  feature,
}: {
  feature: SubFeature;
}) {
  const sectionId = `sec-${feature.subIndex.replace(".", "-")}`;

  return (
    <div
      id={sectionId}
      className="rounded-2xl border border-border/80 bg-card/90 p-5 sm:p-6 shadow-sm hover:border-primary/40 transition-all space-y-4 scroll-mt-28"
    >
      {/* Kártya Fejléc */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary border border-primary/20 font-bold px-2.5 py-1 text-xs rounded-lg shrink-0"
          >
            {feature.subIndex}
          </Badge>
          <h3 className="text-base sm:text-lg font-bold text-foreground">
            {feature.title}
          </h3>
        </div>

        {feature.hogyHivjak && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <Badge
              variant="outline"
              className="gap-1.5 py-1 px-3 bg-muted/60 text-foreground border-border/80 text-xs font-semibold rounded-lg shadow-2xs"
            >
              <MousePointerClick className="h-3.5 w-3.5 text-primary" />
              <span>{parseInlineFormatting(feature.hogyHivjak)}</span>
            </Badge>
          </div>
        )}
      </div>

      {/* Mire való */}
      {feature.mireValo && (
        <div className="flex items-start gap-2.5 rounded-xl bg-muted/30 p-3.5 border border-border/50 text-xs sm:text-sm text-foreground/90">
          <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-foreground">Mire való: </span>
            <span className="leading-relaxed">{parseInlineFormatting(feature.mireValo)}</span>
          </div>
        </div>
      )}

      {/* Hol található a felületen */}
      {feature.holTalalhato && (
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3.5 py-2.5 border border-border/40 text-xs text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <div>
            <strong className="text-foreground font-semibold">Elhelyezkedés: </strong>
            <span>{parseInlineFormatting(feature.holTalalhato)}</span>
          </div>
        </div>
      )}

      {/* Hogyan használhatja a felhasználó (Lépések Stepper) */}
      {feature.steps.length > 0 && (
        <div className="pt-2 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <ListOrdered className="h-4 w-4 text-primary" />
            <span>Hogyan használd lépésről lépésre:</span>
          </div>

          <div className="space-y-2.5 pl-1">
            {feature.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 group">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {idx + 1}
                </div>
                <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed pt-0.5 flex-1">
                  {parseInlineFormatting(step)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Várható eredmény (ha van megadva) */}
      {feature.eredmeny && (
        <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 sm:p-4 flex items-start gap-2.5 text-xs sm:text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-emerald-700 dark:text-emerald-300">
              Várható eredmény:{" "}
            </strong>
            <span className="text-foreground/90">{parseInlineFormatting(feature.eredmeny)}</span>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Tartalomjegyzék komponens (Table of Contents)
 */
export const KnowledgeTableOfContents = React.memo(function KnowledgeTableOfContents({
  toc,
  activeId,
  onSelectId,
}: {
  toc: TocItem[];
  activeId: string;
  onSelectId: (id: string) => void;
}) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  return (
    <>
      {/* Mobil összecsukható sáv */}
      <div className="lg:hidden rounded-xl border border-border/70 bg-card/90 p-3 shadow-sm">
        <button
          type="button"
          onClick={() => setIsOpenMobile((prev) => !prev)}
          className="flex w-full items-center justify-between text-xs font-semibold text-foreground"
        >
          <div className="flex items-center gap-2">
            <ListTree className="h-4 w-4 text-primary" />
            <span>Tartalomjegyzék ({toc.length} fejezet)</span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isOpenMobile ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpenMobile && (
          <div className="mt-3 border-t border-border/50 pt-2 space-y-1">
            {toc.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectId(item.id);
                  setIsOpenMobile(false);
                }}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs rounded-lg transition-colors ${
                  activeId === item.id
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                } ${item.level === 3 ? "pl-5 text-[11px]" : ""}`}
              >
                {item.subIndex && (
                  <span className="text-[10px] font-mono text-primary/80">
                    {item.subIndex}
                  </span>
                )}
                <span className="truncate">{item.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Asztali ragadós (Sticky) Tartalomjegyzék */}
      <nav className="hidden lg:block space-y-3 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <ListTree className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Tartalomjegyzék
          </h3>
        </div>

        <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {toc.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectId(item.id)}
              className={`group flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs rounded-lg transition-all ${
                activeId === item.id
                  ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              } ${item.level === 3 ? "pl-5 text-[11px]" : "font-medium"}`}
            >
              {item.subIndex && (
                <span className="text-[10px] font-mono text-primary/80 shrink-0">
                  {item.subIndex}
                </span>
              )}
              <span className="truncate group-hover:translate-x-0.5 transition-transform">
                {item.title}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
});

/**
 * Fő strukturált cikk tartalom megjelenítő komponens
 */
export const KnowledgeArticleStructuredContent = React.memo(function KnowledgeArticleStructuredContent({
  article,
  jumpUrl,
}: {
  article: KnowledgeArticle;
  jumpUrl?: string | null;
}) {
  const parsed = useMemo(
    () => parseArticleSections(article.content, article.menu_path),
    [article.content, article.menu_path]
  );

  const [activeSectionId, setActiveSectionId] = useState<string>("sec-navigation");

  const handleSelectSection = useCallback((sectionId: string) => {
    setActiveSectionId(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8">
      {/* Bal / Fő Tartalom Oszlop */}
      <div className="flex-1 min-w-0 space-y-8 w-full">
        {/* Mobil Tartalomjegyzék */}
        <KnowledgeTableOfContents
          toc={parsed.toc}
          activeId={activeSectionId}
          onSelectId={handleSelectSection}
        />

        {/* 1. Szekció: Elhelyezkedés és Navigáció */}
        <NavigationSpecCard spec={parsed.navSpec} onJumpUrl={jumpUrl} />

        {/* 2. Szekció: Cél és Fő Feladatok */}
        <PurposeOverviewCard purpose={parsed.purposeOverview} />

        {/* 3. Szekció: Részletes Funkciók Fejléc & Kártyák */}
        <section className="space-y-5 pt-2">
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                3. Részletes Funkciók és Használatuk
              </h2>
              <p className="text-xs text-muted-foreground">
                Minden gomb, kalkulátor és művelet célja, elhelyezkedése és lépésről lépésre útmutatója ({parsed.subFeatures.length} funkció)
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {parsed.subFeatures.map((subFeature) => (
              <FeatureSectionCard key={subFeature.subIndex} feature={subFeature} />
            ))}
          </div>
        </section>
      </div>

      {/* Jobb / Asztali Tartalomjegyzék Oszlop */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-24">
        <KnowledgeTableOfContents
          toc={parsed.toc}
          activeId={activeSectionId}
          onSelectId={handleSelectSection}
        />
      </aside>
    </div>
  );
});
