import React, { useState, useEffect } from 'react';
import { 
  Settings, Building2, Bell, Shield, Users, Globe,
  Save, Check, Loader2, Coffee
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountyRole } from './AccountyRoleContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

// Tab components
import GeneralSettingsTab from './settings/GeneralSettingsTab';
import NotificationSettingsTab from './settings/NotificationSettingsTab';
import TeamSettingsTab from './settings/TeamSettingsTab';
import CafeteriaSettingsTab from './settings/CafeteriaSettingsTab';
import NavChannelTab from './settings/NavChannelTab';
import SecuritySettingsTab from './settings/SecuritySettingsTab';

type SettingsTab = 'general' | 'notifications' | 'team' | 'cafeteria' | 'nav' | 'security';

export default function SettingsPage() {
  const { user } = useAuth();
  const { role: currentUserRole, isAdmin, isSenior } = useAccountyRole();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // General settings state
  const [officeName, setOfficeName] = useState('');
  const [officeEmail, setOfficeEmail] = useState(user?.email || '');
  const [officePhone, setOfficePhone] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [sessionTimeout, setSessionTimeout] = useState(15);

  // Notification defaults
  const [defaultChannels, setDefaultChannels] = useState({
    email: true,
    viber: false,
    sms: false,
    phone: false,
  });
  const [reminderFrequency, setReminderFrequency] = useState('normal');
  const [autoReminder, setAutoReminder] = useState(true);

  // Cafeteria settings
  const [cafeEnabled, setCafeEnabled] = useState(true);
  const [cafeAnnualBudget, setCafeAnnualBudget] = useState('600000');
  const [szepSzallas, setSzepSzallas] = useState('150000');
  const [szepVendeglatas, setSzepVendeglatas] = useState('150000');
  const [szepSzabadido, setSzepSzabadido] = useState('75000');
  const [cafeProvider, setCafeProvider] = useState('otp');
  const [cafeDeadline, setCafeDeadline] = useState('10');

  // NAV channel settings
  const [navApiKey, setNavApiKey] = useState('nav-***-***-***');
  const [navTechnicalUser, setNavTechnicalUser] = useState('TECH_USER_01');
  const [navSignatureKey, setNavSignatureKey] = useState('sig-***-***');
  const [navEnvironment, setNavEnvironment] = useState('production');
  const [navAutoSubmit, setNavAutoSubmit] = useState(false);
  const [navAnykPath, setNavAnykPath] = useState('C:\\ÁNYK\\abevjava');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('accounty_office_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.officeName) setOfficeName(parsed.officeName);
        if (parsed.officeEmail) setOfficeEmail(parsed.officeEmail);
        if (parsed.officePhone) setOfficePhone(parsed.officePhone);
        if (parsed.officeAddress) setOfficeAddress(parsed.officeAddress);
        if (parsed.defaultChannels) setDefaultChannels(parsed.defaultChannels);
        if (parsed.reminderFrequency) setReminderFrequency(parsed.reminderFrequency);
        if (parsed.autoReminder !== undefined) setAutoReminder(parsed.autoReminder);
      }
    } catch {}
    
    if (user?.user_metadata?.accounty_office_settings) {
      const meta = user.user_metadata.accounty_office_settings;
      if (meta.officeName) setOfficeName(meta.officeName);
      if (meta.officeEmail) setOfficeEmail(meta.officeEmail);
      if (meta.officePhone) setOfficePhone(meta.officePhone);
      if (meta.officeAddress) setOfficeAddress(meta.officeAddress);
    }
  }, [user]);

  // ── Firm data from DB ──
  const { data: firmData } = useQuery({
    queryKey: ['accounty-firm-data', user?.id],
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from('accounty_assignments' as any)
        .select('accounting_firm_id')
        .eq('accountant_user_id', user!.id)
        .limit(1);
      if (!assignments || assignments.length === 0) return null;
      const firmId = (assignments[0] as any).accounting_firm_id;
      const { data: company } = await supabase
        .from('companies')
        .select('name, tax_number, address')
        .eq('id', firmId)
        .maybeSingle();
      return company ? { name: company.name, taxNumber: company.tax_number, address: company.address, firmId } : null;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  // Auto-fill office fields from firm data
  useEffect(() => {
    if (firmData) {
      if (firmData.name && !officeName) setOfficeName(firmData.name);
      if (firmData.address && !officeAddress) setOfficeAddress(firmData.address);
    }
  }, [firmData]);

  // ── Team members from DB ──
  const ROLE_PRIORITY: Record<string, number> = { iroda_admin: 4, senior_könyvelő: 3, könyvelő: 2, asszisztens: 1 };

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['accounty-team-members', firmData?.firmId],
    queryFn: async () => {
      const firmId = firmData!.firmId;
      const { data: assignments } = await supabase
        .from('accounty_assignments' as any)
        .select('accountant_user_id, company_id, role')
        .eq('accounting_firm_id', firmId);
      if (!assignments || assignments.length === 0) return [];

      const userRoles: Record<string, { role: string; companies: Set<string> }> = {};
      for (const a of assignments as any[]) {
        const uid = a.accountant_user_id;
        if (!userRoles[uid]) userRoles[uid] = { role: a.role, companies: new Set() };
        userRoles[uid].companies.add(a.company_id);
        if ((ROLE_PRIORITY[a.role] || 0) > (ROLE_PRIORITY[userRoles[uid].role] || 0)) {
          userRoles[uid].role = a.role;
        }
      }

      const userIds = Object.keys(userRoles);
      const { data: profiles } = await supabase.from('profiles').select('user_id, name').in('user_id', userIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach(p => { nameMap[p.user_id] = p.name || 'Névtelen'; });

      const companyIds = [...new Set(assignments.map((a: any) => a.company_id))];
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      const companyMap: Record<string, string> = {};
      (companies || []).forEach(c => { companyMap[c.id] = c.name; });

      return userIds
        .map(uid => ({
          id: uid,
          name: nameMap[uid] || 'Névtelen',
          initial: (nameMap[uid] || 'N').charAt(0).toUpperCase(),
          role: userRoles[uid].role,
          clientCount: userRoles[uid].companies.size,
          assignedCompanies: Array.from(userRoles[uid].companies)
            .map(cid => ({ id: cid, name: companyMap[cid] || 'Ismeretlen cég' }))
            .filter(c => c.name !== 'SANDBOX')
        }))
        .filter(m => m.name !== 'Sandbox' && m.name !== 'Névtelen')
        .sort((a, b) => (ROLE_PRIORITY[b.role] || 0) - (ROLE_PRIORITY[a.role] || 0));
    },
    enabled: !!firmData?.firmId,
    staleTime: 60_000,
  });

  const handleSave = async () => {
    setSaving(true);
    
    const newSettings = {
      officeName,
      officeEmail,
      officePhone,
      officeAddress,
      defaultChannels,
      reminderFrequency,
      autoReminder
    };

    localStorage.setItem('accounty_office_settings', JSON.stringify(newSettings));

    if (user) {
      await supabase.auth.updateUser({
        data: { accounty_office_settings: newSettings }
      });
    }

    setSaving(false);
    setSaved(true);
    toast({ title: ' Beállítások mentve', description: 'A módosítások sikeresen elmentve.' });
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'general' as const, label: 'Általános', icon: Building2 },
    { id: 'notifications' as const, label: 'Értesítések', icon: Bell },
    { id: 'team' as const, label: 'Csapat', icon: Users },
    { id: 'cafeteria' as const, label: 'Cafeteria', icon: Coffee },
    { id: 'nav' as const, label: 'NAV csatorna', icon: Globe },
    { id: 'security' as const, label: 'Biztonság', icon: Shield },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Beállítások</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Könyvelő iroda beállítások és preferenciák</p>
      </div>

      <div className="flex gap-6">
        {/* Left: Tab navigation */}
        <div className="w-56 shrink-0 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary/15 text-primary shadow-soft border border-primary/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Content */}
        <div className="flex-1 bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          {activeTab === 'general' && (
            <GeneralSettingsTab
              officeName={officeName} setOfficeName={setOfficeName}
              officeEmail={officeEmail} setOfficeEmail={setOfficeEmail}
              officePhone={officePhone} setOfficePhone={setOfficePhone}
              officeAddress={officeAddress} setOfficeAddress={setOfficeAddress}
              firmData={firmData}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationSettingsTab
              defaultChannels={defaultChannels} setDefaultChannels={setDefaultChannels}
              reminderFrequency={reminderFrequency} setReminderFrequency={setReminderFrequency}
              autoReminder={autoReminder} setAutoReminder={setAutoReminder}
            />
          )}

          {activeTab === 'team' && (
            <TeamSettingsTab
              teamMembers={teamMembers}
              isAdmin={isAdmin}
              currentUserId={user?.id}
              firmId={firmData?.firmId}
            />
          )}

          {activeTab === 'cafeteria' && (
            <CafeteriaSettingsTab
              cafeEnabled={cafeEnabled} setCafeEnabled={setCafeEnabled}
              cafeAnnualBudget={cafeAnnualBudget} setCafeAnnualBudget={setCafeAnnualBudget}
              szepSzallas={szepSzallas} setSzepSzallas={setSzepSzallas}
              szepVendeglatas={szepVendeglatas} setSzepVendeglatas={setSzepVendeglatas}
              szepSzabadido={szepSzabadido} setSzepSzabadido={setSzepSzabadido}
              cafeProvider={cafeProvider} setCafeProvider={setCafeProvider}
              cafeDeadline={cafeDeadline} setCafeDeadline={setCafeDeadline}
            />
          )}

          {activeTab === 'nav' && (
            <NavChannelTab
              navApiKey={navApiKey} setNavApiKey={setNavApiKey}
              navTechnicalUser={navTechnicalUser} setNavTechnicalUser={setNavTechnicalUser}
              navSignatureKey={navSignatureKey} setNavSignatureKey={setNavSignatureKey}
              navEnvironment={navEnvironment} setNavEnvironment={setNavEnvironment}
              navAutoSubmit={navAutoSubmit} setNavAutoSubmit={setNavAutoSubmit}
              navAnykPath={navAnykPath} setNavAnykPath={setNavAnykPath}
            />
          )}

          {activeTab === 'security' && (
            <SecuritySettingsTab
              sessionTimeout={sessionTimeout} setSessionTimeout={setSessionTimeout}
            />
          )}

          {/* Save button */}
          <div className="p-4 border-t border-border dark:bg-slate-900/50 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "gap-2 transition-all",
                saved 
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Mentés...</>
              ) : saved ? (
                <><Check className="w-4 h-4" /> Mentve!</>
              ) : (
                <><Save className="w-4 h-4" /> Mentés</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
