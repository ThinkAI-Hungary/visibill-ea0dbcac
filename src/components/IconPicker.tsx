import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Search, Palette } from 'lucide-react';
import {
  Megaphone, Monitor, Zap, Truck, Paperclip, Coffee,
  Landmark, Receipt, Users, FolderOpen,
  ShoppingCart, CreditCard, Briefcase, Building2, Home,
  Phone, Mail, Globe, Wifi, Server,
  Shield, Lock, Key, FileText, File,
  Calculator, PieChart, BarChart3, TrendingUp, TrendingDown,
  DollarSign, Banknote, Wallet, Coins, PiggyBank,
  Package, Box, Archive, Warehouse, Factory,
  Car, Plane, Train, Ship, Fuel,
  Utensils, Apple, ShoppingBag, Gift, Heart,
  Star, Tag, Tags, Bookmark, Flag,
  Wrench, Settings, Cog, Hammer, Paintbrush,
  Camera, Printer, Tv, Headphones, Smartphone,
  GraduationCap, BookOpen, Library, Newspaper, Pen,
  Stethoscope, Activity, Pill, Syringe, Thermometer,
  TreePine, Sun, Droplets, Leaf, Flower2,
  Scale, Gavel, ScrollText, ClipboardList, ListChecks,
  type LucideIcon
} from 'lucide-react';

// Curated icon library organized by business category
export const ICON_LIBRARY: { name: string; icon: LucideIcon; category: string }[] = [
  // Pénzügyek
  { name: 'DollarSign', icon: DollarSign, category: 'Pénzügyek' },
  { name: 'Banknote', icon: Banknote, category: 'Pénzügyek' },
  { name: 'Wallet', icon: Wallet, category: 'Pénzügyek' },
  { name: 'Coins', icon: Coins, category: 'Pénzügyek' },
  { name: 'PiggyBank', icon: PiggyBank, category: 'Pénzügyek' },
  { name: 'CreditCard', icon: CreditCard, category: 'Pénzügyek' },
  { name: 'Receipt', icon: Receipt, category: 'Pénzügyek' },
  { name: 'Calculator', icon: Calculator, category: 'Pénzügyek' },
  { name: 'Landmark', icon: Landmark, category: 'Pénzügyek' },
  { name: 'Scale', icon: Scale, category: 'Pénzügyek' },

  // Üzlet
  { name: 'Briefcase', icon: Briefcase, category: 'Üzlet' },
  { name: 'Building2', icon: Building2, category: 'Üzlet' },
  { name: 'ShoppingCart', icon: ShoppingCart, category: 'Üzlet' },
  { name: 'ShoppingBag', icon: ShoppingBag, category: 'Üzlet' },
  { name: 'Users', icon: Users, category: 'Üzlet' },
  { name: 'Factory', icon: Factory, category: 'Üzlet' },
  { name: 'Warehouse', icon: Warehouse, category: 'Üzlet' },

  // Marketing & Kommunikáció
  { name: 'Megaphone', icon: Megaphone, category: 'Marketing' },
  { name: 'Globe', icon: Globe, category: 'Marketing' },
  { name: 'Mail', icon: Mail, category: 'Marketing' },
  { name: 'Phone', icon: Phone, category: 'Marketing' },
  { name: 'Newspaper', icon: Newspaper, category: 'Marketing' },
  { name: 'Tag', icon: Tag, category: 'Marketing' },
  { name: 'Tags', icon: Tags, category: 'Marketing' },
  { name: 'Gift', icon: Gift, category: 'Marketing' },

  // IT & Technológia
  { name: 'Monitor', icon: Monitor, category: 'IT' },
  { name: 'Server', icon: Server, category: 'IT' },
  { name: 'Wifi', icon: Wifi, category: 'IT' },
  { name: 'Smartphone', icon: Smartphone, category: 'IT' },
  { name: 'Printer', icon: Printer, category: 'IT' },
  { name: 'Tv', icon: Tv, category: 'IT' },
  { name: 'Headphones', icon: Headphones, category: 'IT' },
  { name: 'Camera', icon: Camera, category: 'IT' },
  { name: 'Shield', icon: Shield, category: 'IT' },
  { name: 'Lock', icon: Lock, category: 'IT' },

  // Szállítás & Logisztika
  { name: 'Truck', icon: Truck, category: 'Szállítás' },
  { name: 'Car', icon: Car, category: 'Szállítás' },
  { name: 'Plane', icon: Plane, category: 'Szállítás' },
  { name: 'Train', icon: Train, category: 'Szállítás' },
  { name: 'Ship', icon: Ship, category: 'Szállítás' },
  { name: 'Fuel', icon: Fuel, category: 'Szállítás' },
  { name: 'Package', icon: Package, category: 'Szállítás' },
  { name: 'Box', icon: Box, category: 'Szállítás' },

  // Iroda & Adminisztráció
  { name: 'Paperclip', icon: Paperclip, category: 'Iroda' },
  { name: 'FileText', icon: FileText, category: 'Iroda' },
  { name: 'File', icon: File, category: 'Iroda' },
  { name: 'ClipboardList', icon: ClipboardList, category: 'Iroda' },
  { name: 'ListChecks', icon: ListChecks, category: 'Iroda' },
  { name: 'ScrollText', icon: ScrollText, category: 'Iroda' },
  { name: 'Pen', icon: Pen, category: 'Iroda' },
  { name: 'Archive', icon: Archive, category: 'Iroda' },
  { name: 'FolderOpen', icon: FolderOpen, category: 'Iroda' },
  { name: 'Bookmark', icon: Bookmark, category: 'Iroda' },

  // Közüzemi & Ingatlan
  { name: 'Zap', icon: Zap, category: 'Közüzemi' },
  { name: 'Home', icon: Home, category: 'Közüzemi' },
  { name: 'Droplets', icon: Droplets, category: 'Közüzemi' },
  { name: 'Sun', icon: Sun, category: 'Közüzemi' },
  { name: 'Thermometer', icon: Thermometer, category: 'Közüzemi' },

  // Vendéglátás & Élelmiszer
  { name: 'Coffee', icon: Coffee, category: 'Egyéb' },
  { name: 'Utensils', icon: Utensils, category: 'Egyéb' },
  { name: 'Apple', icon: Apple, category: 'Egyéb' },

  // Oktatás & Egészségügy
  { name: 'GraduationCap', icon: GraduationCap, category: 'Oktatás' },
  { name: 'BookOpen', icon: BookOpen, category: 'Oktatás' },
  { name: 'Library', icon: Library, category: 'Oktatás' },
  { name: 'Stethoscope', icon: Stethoscope, category: 'Egészségügy' },
  { name: 'Activity', icon: Activity, category: 'Egészségügy' },
  { name: 'Heart', icon: Heart, category: 'Egészségügy' },

  // Karbantartás & Fejlesztés
  { name: 'Wrench', icon: Wrench, category: 'Karbantartás' },
  { name: 'Settings', icon: Settings, category: 'Karbantartás' },
  { name: 'Cog', icon: Cog, category: 'Karbantartás' },
  { name: 'Hammer', icon: Hammer, category: 'Karbantartás' },
  { name: 'Paintbrush', icon: Paintbrush, category: 'Karbantartás' },

  // Analitika
  { name: 'PieChart', icon: PieChart, category: 'Analitika' },
  { name: 'BarChart3', icon: BarChart3, category: 'Analitika' },
  { name: 'TrendingUp', icon: TrendingUp, category: 'Analitika' },
  { name: 'TrendingDown', icon: TrendingDown, category: 'Analitika' },

  // Egyéb jelölők
  { name: 'Star', icon: Star, category: 'Egyéb' },
  { name: 'Flag', icon: Flag, category: 'Egyéb' },
  { name: 'Gavel', icon: Gavel, category: 'Egyéb' },
  { name: 'Key', icon: Key, category: 'Egyéb' },
  { name: 'Leaf', icon: Leaf, category: 'Egyéb' },
  { name: 'Flower2', icon: Flower2, category: 'Egyéb' },
  { name: 'TreePine', icon: TreePine, category: 'Egyéb' },
];

// Resolve icon name string to LucideIcon component
const iconMap = new Map(ICON_LIBRARY.map(i => [i.name, i.icon]));

export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return FolderOpen;
  return iconMap.get(name) || FolderOpen;
}

// Category labels in Hungarian
const CATEGORY_LABELS: Record<string, string> = {
  'Pénzügyek': 'Pénzügyek',
  'Üzlet': 'Üzlet',
  'Marketing': 'Marketing',
  'IT': 'IT & Technológia',
  'Szállítás': 'Szállítás',
  'Iroda': 'Iroda',
  'Közüzemi': 'Közüzemi',
  'Oktatás': 'Oktatás',
  'Egészségügy': 'Egészségügy',
  'Karbantartás': 'Karbantartás',
  'Analitika': 'Analitika',
  'Egyéb': 'Egyéb',
};

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  color?: string;
}

export function IconPicker({ value, onChange, color = 'hsl(var(--primary))' }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const SelectedIcon = resolveIcon(value);

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return ICON_LIBRARY;
    const q = search.toLowerCase();
    return ICON_LIBRARY.filter(i => 
      i.name.toLowerCase().includes(q) || 
      i.category.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof ICON_LIBRARY> = {};
    for (const item of filteredIcons) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filteredIcons]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-12 h-12 p-0 flex items-center justify-center rounded-xl border-2 border-border bg-background hover:border-primary/50 transition-colors duration-200 outline-none focus:outline-none"
          style={{ borderColor: open ? color : undefined }}
        >
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: color + '20', color }}
          >
            <SelectedIcon className="h-5 w-5" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="start"
        side="right"
        sideOffset={8}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Ikon keresése..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
              autoFocus
            />
          </div>
        </div>

        {/* Icon grid */}
        <div className="max-h-72 overflow-y-auto p-2">
          {Object.entries(grouped).map(([category, icons]) => (
            <div key={category} className="mb-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
                {CATEGORY_LABELS[category] || category}
              </div>
              <div className="grid grid-cols-8 gap-0.5">
                {icons.map((item) => {
                  const Icon = item.icon;
                  const isSelected = value === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1'
                          : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                      }`}
                      onClick={() => {
                        onChange(item.name);
                        setOpen(false);
                        setSearch('');
                      }}
                      title={item.name}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filteredIcons.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nincs találat
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Color Picker ────────────────────────────────────────────────

export const COLOR_PALETTE = [
  // Row 1 — vivid
  { value: 'hsl(142, 76%, 36%)', label: 'Zöld' },
  { value: 'hsl(217, 91%, 60%)', label: 'Kék' },
  { value: 'hsl(43, 96%, 56%)',  label: 'Sárga' },
  { value: 'hsl(189, 94%, 43%)', label: 'Cián' },
  { value: 'hsl(21, 90%, 48%)',  label: 'Narancs' },
  { value: 'hsl(263, 70%, 50%)', label: 'Lila' },
  { value: 'hsl(340, 82%, 52%)', label: 'Rózsaszín' },
  { value: 'hsl(239, 84%, 67%)', label: 'Indigó' },
  { value: 'hsl(174, 83%, 32%)', label: 'Türkiz' },
  { value: 'hsl(0, 84%, 60%)',   label: 'Piros' },
  // Row 2 — muted / pastel
  { value: 'hsl(142, 50%, 50%)', label: 'Halvány zöld' },
  { value: 'hsl(217, 60%, 50%)', label: 'Acélkék' },
  { value: 'hsl(32, 95%, 44%)',  label: 'Borostyán' },
  { value: 'hsl(189, 50%, 55%)', label: 'Halvány cián' },
  { value: 'hsl(280, 60%, 55%)', label: 'Ametiszt' },
  { value: 'hsl(350, 60%, 50%)', label: 'Bordó' },
  { value: 'hsl(160, 60%, 40%)', label: 'Smaragd' },
  { value: 'hsl(200, 70%, 45%)', label: 'Óceán' },
  { value: 'hsl(15, 80%, 55%)',  label: 'Terrakotta' },
  { value: 'hsl(220, 9%, 46%)',  label: 'Szürke' },
];

export const DEFAULT_CATEGORY_COLOR = 'hsl(174, 83%, 32%)';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  iconName?: string;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-12 h-12 p-0 flex items-center justify-center rounded-xl border-2 border-border bg-background hover:border-primary/50 transition-colors duration-200 outline-none focus:outline-none"
          style={{ borderColor: open ? value : undefined }}
        >
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: value + '20', color: value }}
          >
            <Palette className="h-5 w-5" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        align="start"
        side="right"
        sideOffset={8}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Szín választás
        </div>
        <div className="grid grid-cols-10 gap-1.5">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`w-7 h-7 rounded-md transition-all hover:scale-110 ${
                value === c.value
                  ? 'ring-2 ring-offset-2 ring-offset-background scale-110'
                  : 'hover:ring-1 hover:ring-offset-1 hover:ring-offset-background'
              }`}
              style={{
                backgroundColor: c.value,
                ringColor: value === c.value ? c.value : undefined,
              }}
              onClick={() => {
                onChange(c.value);
                setOpen(false);
              }}
              title={c.label}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
