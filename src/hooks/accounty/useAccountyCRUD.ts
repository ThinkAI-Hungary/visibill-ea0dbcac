/**
 * Accounty CRUD hooks — retention rules, data contracts, sites, cost centers, departments, year-end tasks.
 * Split from useAccountyData.ts for maintainability.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

// ── Types ──

export interface RetentionRule {
  id: string;
  companyId: string;
  docType: string;
  retentionYears: number;
  legalBasis: string;
  autoDelete: boolean;
}

export interface DataContract {
  id: string;
  companyId: string;
  partnerName: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
  validUntil: string | null;
  status: 'active' | 'expired';
}

export interface Site {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address: string;
  mainActivity: string;
  headcount: number;
}

export interface CostCenter {
  id: string;
  companyId: string;
  parentId: string | null;
  code: string;
  name: string;
  responsible: string;
  headcount: number;
  children?: CostCenter[];
}

export interface Department {
  id: string;
  companyId: string;
  siteId: string | null;
  name: string;
  manager: string;
  headcount: number;
}

export interface YearEndTask {
  id: string;
  companyId: string;
  year: number;
  title: string;
  subtitle: string;
  category: string;
  iconName: string;
  color: string;
  deadline: string | null;
  status: 'done' | 'in_progress' | 'pending' | 'blocked';
  legalRef: string;
  checklist: { item: string; done: boolean }[];
  outputLabel: string;
  sortOrder: number;
}

// ── Retention Rules ──

const DEFAULT_RETENTION_RULES: Omit<RetentionRule, 'id' | 'companyId'>[] = [
  { docType: 'Munkaszerződés', retentionYears: 3, legalBasis: 'Mt. 286. §', autoDelete: false },
  { docType: 'Bérjegyzék', retentionYears: 8, legalBasis: 'Sztv. 169. §', autoDelete: true },
  { docType: 'TAJ-kártya másolat', retentionYears: 3, legalBasis: 'Mt. 286. §', autoDelete: true },
  { docType: 'Adóelőleg-nyilatkozat', retentionYears: 5, legalBasis: 'Art. 78. §', autoDelete: true },
  { docType: 'Bevallási XML', retentionYears: 8, legalBasis: 'Sztv. 169. §', autoDelete: false },
  { docType: 'Kilépő dokumentumok', retentionYears: 3, legalBasis: 'Mt. 286. §', autoDelete: false },
  { docType: 'Nyugdíj-releváns iratok', retentionYears: 50, legalBasis: 'Tny. törvény', autoDelete: false },
  { docType: 'GDPR hozzájárulás', retentionYears: 5, legalBasis: 'GDPR 7. cikk', autoDelete: true },
];

export function useRetentionRules(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyRetentionRules(companyId),
    queryFn: async (): Promise<RetentionRule[]> => {
      const { data, error } = await supabase.from('accounty_retention_rules').select('*').eq('company_id', companyId).order('doc_type');
      if (error) throw error;
      return (data || []).map(r => ({ id: r.id, companyId: r.company_id, docType: r.doc_type, retentionYears: r.retention_years, legalBasis: r.legal_basis || '', autoDelete: r.auto_delete || false }));
    },
    enabled: !!companyId,
  });
}

export function useSeedRetentionRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (companyId: string) => {
      const rows = DEFAULT_RETENTION_RULES.map(r => ({ company_id: companyId, doc_type: r.docType, retention_years: r.retentionYears, legal_basis: r.legalBasis, auto_delete: r.autoDelete }));
      const { error } = await supabase.from('accounty_retention_rules').upsert(rows, { onConflict: 'company_id,doc_type' });
      if (error) throw error;
    },
    onSuccess: (_, companyId) => { qc.invalidateQueries({ queryKey: queryKeys.accountyRetentionRules(companyId) }); },
  });
}

export function useUpdateRetentionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: RetentionRule) => {
      const { error } = await supabase.from('accounty_retention_rules').update({ retention_years: rule.retentionYears, legal_basis: rule.legalBasis, auto_delete: rule.autoDelete, updated_at: new Date().toISOString() }).eq('id', rule.id);
      if (error) throw error;
      return rule.companyId;
    },
    onSuccess: (companyId) => { qc.invalidateQueries({ queryKey: queryKeys.accountyRetentionRules(companyId) }); },
  });
}

export function useAddRetentionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<RetentionRule, 'id'>) => {
      const { error } = await supabase.from('accounty_retention_rules').insert({ company_id: rule.companyId, doc_type: rule.docType, retention_years: rule.retentionYears, legal_basis: rule.legalBasis, auto_delete: rule.autoDelete });
      if (error) throw error;
      return rule.companyId;
    },
    onSuccess: (companyId) => { qc.invalidateQueries({ queryKey: queryKeys.accountyRetentionRules(companyId) }); },
  });
}

export function useDeleteRetentionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase.from('accounty_retention_rules').delete().eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => { qc.invalidateQueries({ queryKey: queryKeys.accountyRetentionRules(companyId) }); },
  });
}

// ── Data Contracts ──

export function useDataContracts(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyDataContracts(companyId),
    queryFn: async (): Promise<DataContract[]> => {
      const { data, error } = await supabase.from('accounty_data_contracts').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(c => ({ id: c.id, companyId: c.company_id, partnerName: c.partner_name, fileName: c.file_name || '', fileUrl: c.file_url || '', uploadDate: c.upload_date, validUntil: c.valid_until, status: c.status }));
    },
    enabled: !!companyId,
  });
}

export function useAddDataContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contract: Omit<DataContract, 'id'>) => {
      const { error } = await supabase.from('accounty_data_contracts').insert({ company_id: contract.companyId, partner_name: contract.partnerName, file_name: contract.fileName, file_url: contract.fileUrl, upload_date: contract.uploadDate, valid_until: contract.validUntil, status: contract.status });
      if (error) throw error;
      return contract.companyId;
    },
    onSuccess: (companyId) => { qc.invalidateQueries({ queryKey: queryKeys.accountyDataContracts(companyId) }); },
  });
}

export function useDeleteDataContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId, fileUrl }: { id: string; companyId: string; fileUrl?: string }) => {
      if (fileUrl) await supabase.storage.from('accounty_contracts').remove([fileUrl]);
      const { error } = await supabase.from('accounty_data_contracts').delete().eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => { qc.invalidateQueries({ queryKey: queryKeys.accountyDataContracts(companyId) }); },
  });
}

// ── Sites ──

export function useSites(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountySites(companyId),
    queryFn: async (): Promise<Site[]> => {
      const { data, error } = await supabase.from('accounty_sites').select('*').eq('company_id', companyId).order('code');
      if (error) throw error;
      return (data || []).map(r => ({ id: r.id, companyId: r.company_id, code: r.code, name: r.name, address: r.address || '', mainActivity: r.main_activity || '', headcount: r.headcount || 0 }));
    },
    enabled: !!companyId,
  });
}

export function useAddSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (site: Omit<Site, 'id'>) => {
      const { error } = await supabase.from('accounty_sites').insert({ company_id: site.companyId, code: site.code, name: site.name, address: site.address, main_activity: site.mainActivity, headcount: site.headcount });
      if (error) throw error;
      return site.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: queryKeys.accountySites(cid) }); },
  });
}

export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (site: Site) => {
      const { error } = await supabase.from('accounty_sites').update({ code: site.code, name: site.name, address: site.address, main_activity: site.mainActivity, headcount: site.headcount, updated_at: new Date().toISOString() }).eq('id', site.id);
      if (error) throw error;
      return site.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: queryKeys.accountySites(cid) }); },
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase.from('accounty_sites').delete().eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: queryKeys.accountySites(cid) }); },
  });
}

// ── Cost Centers ──

export function useCostCenters(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyCostCenters(companyId),
    queryFn: async (): Promise<CostCenter[]> => {
      const { data, error } = await supabase.from('accounty_cost_centers').select('*').eq('company_id', companyId).order('code');
      if (error) throw error;
      const flat = (data || []).map(r => ({ id: r.id, companyId: r.company_id, parentId: r.parent_id, code: r.code, name: r.name, responsible: r.responsible || '', headcount: r.headcount || 0 }));
      const map = new Map<string, CostCenter>();
      flat.forEach(n => map.set(n.id, { ...n, children: [] }));
      const roots: CostCenter[] = [];
      flat.forEach(n => {
        const node = map.get(n.id)!;
        if (n.parentId && map.has(n.parentId)) { map.get(n.parentId)!.children!.push(node); } else { roots.push(node); }
      });
      return roots;
    },
    enabled: !!companyId,
  });
}

export function useAddCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cc: Omit<CostCenter, 'id' | 'children'>) => {
      const { error } = await supabase.from('accounty_cost_centers').insert({ company_id: cc.companyId, parent_id: cc.parentId, code: cc.code, name: cc.name, responsible: cc.responsible, headcount: cc.headcount });
      if (error) throw error;
      return cc.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: queryKeys.accountyCostCenters(cid) }); },
  });
}

export function useUpdateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cc: CostCenter) => {
      const { error } = await supabase.from('accounty_cost_centers').update({ code: cc.code, name: cc.name, responsible: cc.responsible, headcount: cc.headcount, parent_id: cc.parentId, updated_at: new Date().toISOString() }).eq('id', cc.id);
      if (error) throw error;
      return cc.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: queryKeys.accountyCostCenters(cid) }); },
  });
}

export function useDeleteCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase.from('accounty_cost_centers').delete().eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: queryKeys.accountyCostCenters(cid) }); },
  });
}

// ── Departments ──

export function useDepartments(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyDepartments(companyId),
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await supabase.from('accounty_departments').select('*').eq('company_id', companyId).order('name');
      if (error) throw error;
      return (data || []).map(r => ({ id: r.id, companyId: r.company_id, siteId: r.site_id, name: r.name, manager: r.manager || '', headcount: r.headcount || 0 }));
    },
    enabled: !!companyId,
  });
}

export function useAddDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dept: Omit<Department, 'id'>) => {
      const { error } = await supabase.from('accounty_departments').insert({ company_id: dept.companyId, site_id: dept.siteId, name: dept.name, manager: dept.manager, headcount: dept.headcount });
      if (error) throw error;
      return dept.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: queryKeys.accountyDepartments(cid) }); },
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dept: Department) => {
      const { error } = await supabase.from('accounty_departments').update({ site_id: dept.siteId, name: dept.name, manager: dept.manager, headcount: dept.headcount, updated_at: new Date().toISOString() }).eq('id', dept.id);
      if (error) throw error;
      return dept.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: queryKeys.accountyDepartments(cid) }); },
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase.from('accounty_departments').delete().eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: queryKeys.accountyDepartments(cid) }); },
  });
}

// ── Year-End Tasks ──

export function useYearEndTasks(companyId: string, year: number) {
  return useQuery({
    queryKey: queryKeys.accountyYearEndTasks(companyId, year),
    queryFn: async (): Promise<YearEndTask[]> => {
      const { data, error } = await supabase.from('accounty_year_end_tasks').select('*').eq('company_id', companyId).eq('year', year).order('sort_order');
      if (error) throw error;
      return (data || []).map(r => ({ id: r.id, companyId: r.company_id, year: r.year, title: r.title, subtitle: r.subtitle || '', category: r.category || 'general', iconName: r.icon_name || 'FileText', color: r.color || 'from-blue-500 to-indigo-500', deadline: r.deadline, status: r.status, legalRef: r.legal_ref || '', checklist: (r.checklist as YearEndTask['checklist']) || [], outputLabel: r.output_label || '', sortOrder: r.sort_order || 0 }));
    },
    enabled: !!companyId,
  });
}

export function useAddYearEndTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Omit<YearEndTask, 'id'>) => {
      const { error } = await supabase.from('accounty_year_end_tasks').insert({ company_id: task.companyId, year: task.year, title: task.title, subtitle: task.subtitle, category: task.category, icon_name: task.iconName, color: task.color, deadline: task.deadline, status: task.status, legal_ref: task.legalRef, checklist: task.checklist, output_label: task.outputLabel, sort_order: task.sortOrder });
      if (error) throw error;
      return { companyId: task.companyId, year: task.year };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: queryKeys.accountyYearEndTasks(k.companyId, k.year) }); },
  });
}

export function useUpdateYearEndTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: YearEndTask) => {
      const { error } = await supabase.from('accounty_year_end_tasks').update({ title: task.title, subtitle: task.subtitle, status: task.status, checklist: task.checklist, updated_at: new Date().toISOString() }).eq('id', task.id);
      if (error) throw error;
      return { companyId: task.companyId, year: task.year };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: queryKeys.accountyYearEndTasks(k.companyId, k.year) }); },
  });
}

export function useDeleteYearEndTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId, year }: { id: string; companyId: string; year: number }) => {
      const { error } = await supabase.from('accounty_year_end_tasks').delete().eq('id', id);
      if (error) throw error;
      return { companyId, year };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: queryKeys.accountyYearEndTasks(k.companyId, k.year) }); },
  });
}

export function useSeedYearEndTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, year }: { companyId: string; year: number }) => {
      const defaults = [
        { title: 'M30 Jövedelemigazolás', subtitle: 'Munkáltatói igazolás kiküldése minden dolgozónak', icon_name: 'FileText', color: 'from-blue-500 to-indigo-500', deadline: `${year + 1}-01-31`, legal_ref: 'Szja tv. 46. § (4)', checklist: [{ item: 'Éves jövedelem adatok véglegesítése', done: false }, { item: 'Családi kedvezmény összesítés', done: false }, { item: 'M30 PDF generálás', done: false }], sort_order: 1 },
        { title: 'Szabadság átvitel', subtitle: 'Ki nem vett szabadságnapok átvezetése', icon_name: 'Calendar', color: 'from-emerald-500 to-teal-500', deadline: `${year + 1}-01-15`, legal_ref: 'Mt. 123. § (5)', checklist: [{ item: 'Maradék szabadságnapok lekérdezése', done: false }, { item: 'Átviteli korlát ellenőrzés', done: false }, { item: 'Szabadságkeret frissítés', done: false }], sort_order: 2 },
        { title: 'Cafeteria záró rendezés', subtitle: 'SZÉP kártya és juttatások éves zárása', icon_name: 'Gift', color: 'from-pink-500 to-rose-500', deadline: `${year}-12-31`, legal_ref: 'Szja tv. 71. §', checklist: [{ item: 'Cafeteria keret felhasználás ellenőrzése', done: false }, { item: 'SZÉP kártya egyenleg záró kimutatás', done: false }], sort_order: 3 },
        { title: 'Rehabilitációs hozzájárulás', subtitle: 'Éves rehabilitációs hozzájárulás bevallás', icon_name: 'Shield', color: 'from-amber-500 to-orange-500', deadline: `${year + 1}-03-31`, legal_ref: 'Mmtv. 23. §', checklist: [{ item: 'Stat. létszám kiszámítása', done: false }, { item: 'Kötelező foglalkoztatási arány ellenőrzése', done: false }, { item: 'REHAB bevallás beküldése', done: false }], sort_order: 4 },
        { title: '2658 Éves összesítő bevallás', subtitle: 'Éves összesítő járulékbevallás', icon_name: 'Briefcase', color: 'from-cyan-500 to-blue-500', deadline: `${year + 1}-02-25`, legal_ref: 'Art. 50. §', checklist: [{ item: 'Havi bevallások egyeztetése', done: false }, { item: 'XML generálás és beküldés', done: false }], sort_order: 5 },
        { title: 'Minimálbér-emelés előkészítés', subtitle: 'Következő évi minimálbér átvezetés', icon_name: 'TrendingUp', color: 'from-green-500 to-emerald-500', deadline: `${year + 1}-01-01`, legal_ref: 'Mt. 153. §', checklist: [{ item: 'Új minimálbér rögzítése', done: false }, { item: 'Érintett munkavállalók azonosítása', done: false }, { item: 'Szerződésmódosítások előkészítése', done: false }], sort_order: 6 },
      ];
      const { error } = await supabase.from('accounty_year_end_tasks').insert(
        defaults.map(d => ({ ...d, company_id: companyId, year, status: 'pending', output_label: '' }))
      );
      if (error) throw error;
      return { companyId, year };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: queryKeys.accountyYearEndTasks(k.companyId, k.year) }); },
  });
}
