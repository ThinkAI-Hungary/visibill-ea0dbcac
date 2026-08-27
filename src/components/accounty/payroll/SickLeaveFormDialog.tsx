import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Printer } from 'lucide-react';
import type { PayrollEmployee, PayrollLeave } from '@/hooks/usePayrollData';
import {
  printSickLeaveStatement,
  printCsedGyedStatement,
  printPregnancySickLeaveStatement,
  printWorkplaceAccidentReport,
} from '@/lib/payroll/sickLeaveTemplates';

interface SickLeaveFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: 'sick' | 'csed_gyed' | 'pregnancy' | 'accident' | null;
  employee: PayrollEmployee;
  company: {
    name: string;
    taxNumber: string;
    address: string;
  } | null;
  leaves: PayrollLeave[];
}

export function SickLeaveFormDialog({
  open,
  onOpenChange,
  documentType,
  employee,
  company,
  leaves,
}: SickLeaveFormDialogProps) {
  // Filter leaves that are related to sick/medical leave
  const sickLeaves = leaves.filter(
    (l) =>
      l.leave_type === 'sick' ||
      l.leave_type === 'sick_leave' ||
      l.leave_type === 'sick_pay' ||
      l.leave_type === 'pregnancy_sick_leave' ||
      l.leave_type === 'tappenz'
  );

  // Form states
  const [selectedLeaveId, setSelectedLeaveId] = useState<string>('__manual__');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState(0);

  // Common extra states
  const [notes, setNotes] = useState('');

  // 1. Sick leave / Pregnancy sick leave extra states
  const [medicalCertNo, setMedicalCertNo] = useState('');
  const [doctorName, setDoctorName] = useState('');

  // 2. CSED / GYED extra states
  const [benefitType, setBenefitType] = useState<'csed' | 'gyed'>('csed');
  const [childName, setChildName] = useState('');
  const [childBirthDate, setChildBirthDate] = useState('');
  const [expectedDateOfDelivery, setExpectedDateOfDelivery] = useState('');
  const [expectedStartDate, setExpectedStartDate] = useState('');

  // 3. Workplace Accident extra states
  const [accidentDate, setAccidentDate] = useState('');
  const [accidentTime, setAccidentTime] = useState('');
  const [accidentLocation, setAccidentLocation] = useState('');
  const [accidentDescription, setAccidentDescription] = useState('');
  const [safetyEquipment, setSafetyEquipment] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [injuryDetails, setInjuryDetails] = useState('');

  // Reset form when documentType or open state changes
  useEffect(() => {
    if (open) {
      setSelectedLeaveId(sickLeaves.length > 0 ? sickLeaves[0].id : '__manual__');
      setStartDate(sickLeaves.length > 0 ? sickLeaves[0].start_date : '');
      setEndDate(sickLeaves.length > 0 ? sickLeaves[0].end_date : '');
      setDays(sickLeaves.length > 0 ? Number(sickLeaves[0].days) : 0);

      // Reset extra fields
      setNotes('');
      setMedicalCertNo('');
      setDoctorName('');
      setChildName('');
      setChildBirthDate('');
      setExpectedDateOfDelivery('');
      setExpectedStartDate('');
      setAccidentDate('');
      setAccidentTime('');
      setAccidentLocation('');
      setAccidentDescription('');
      setSafetyEquipment('');
      setWitnesses('');
      setInjuryDetails('');
    }
  }, [open, documentType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle selected leave change
  const handleLeaveChange = (id: string) => {
    setSelectedLeaveId(id);
    if (id === '__manual__') {
      setStartDate('');
      setEndDate('');
      setDays(0);
    } else {
      const match = sickLeaves.find((l) => l.id === id);
      if (match) {
        setStartDate(match.start_date);
        setEndDate(match.end_date);
        setDays(Number(match.days));
      }
    }
  };

  // Safe company details fallback
  const companyInfo = company || {
    name: 'Thinkai Kft.',
    taxNumber: '27384950-2-42',
    address: '1113 Budapest, Bocskai út 77-79.',
  };

  const employeeInfo = {
    name: `${employee.last_name} ${employee.first_name}`,
    birthName: employee.birth_name || undefined,
    birthPlace: employee.birth_place || undefined,
    birthDate: employee.birth_date || undefined,
    mothersName: employee.mothers_name || undefined,
    tajNumber: employee.taj_number || '–',
    taxId: employee.tax_id || '–',
    address: employee.address ? `${employee.address.city || ''}, ${employee.address.street || ''} ${employee.address.number || ''}` : undefined,
    jobTitle: employee.phone || '–', // Fallback or title
    bankAccount: employee.bank_account || '–',
  };

  const handlePrint = () => {
    const leaveData = { startDate, endDate, days };

    if (documentType === 'sick') {
      printSickLeaveStatement(companyInfo, employeeInfo, leaveData, {
        medicalCertNo,
        doctorName,
        notes,
      });
    } else if (documentType === 'csed_gyed') {
      printCsedGyedStatement(companyInfo, employeeInfo, leaveData, {
        benefitType,
        childName,
        childBirthDate,
        expectedDateOfDelivery: expectedDateOfDelivery || undefined,
        expectedStartDate: expectedStartDate || startDate || new Date().toISOString().slice(0, 10),
        notes,
      });
    } else if (documentType === 'pregnancy') {
      printPregnancySickLeaveStatement(companyInfo, employeeInfo, leaveData, {
        medicalCertNo,
        obgynName: doctorName,
        expectedDeliveryDate: expectedDateOfDelivery,
        notes,
      });
    } else if (documentType === 'accident') {
      printWorkplaceAccidentReport(companyInfo, employeeInfo, {
        accidentDate: accidentDate || startDate,
        accidentTime,
        location: accidentLocation,
        description: accidentDescription,
        injuryDetails,
        witnesses,
        safetyEquipment,
        notes,
      });
    }

    onOpenChange(false);
  };

  const getTitle = () => {
    switch (documentType) {
      case 'sick':
        return 'Táppénz Igénylő Lap Kitöltése';
      case 'csed_gyed':
        return 'CSED/GYED Foglalkoztatói Igazolás';
      case 'pregnancy':
        return 'Veszélyeztetett Terhességi Igazolás';
      case 'accident':
        return 'Munkabaleseti Jegyzőkönyv';
      default:
        return 'Nyomtatvány Generálása';
    }
  };

  const isFormValid = () => {
    if (documentType !== 'accident') {
      if (!startDate || !endDate) return false;
    }
    if (documentType === 'csed_gyed') {
      if (!childName || !childBirthDate) return false;
    }
    if (documentType === 'pregnancy') {
      if (!medicalCertNo || !doctorName || !expectedDateOfDelivery) return false;
    }
    if (documentType === 'accident') {
      if (!accidentLocation || !accidentDescription || !injuryDetails) return false;
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Leave selector for period pre-filling */}
          {documentType !== 'accident' && (
            <div className="space-y-1.5">
              <Label>Távolléti Időszak Kiválasztása</Label>
              <Select value={selectedLeaveId} onValueChange={handleLeaveChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Válassz távollétet..." />
                </SelectTrigger>
                <SelectContent>
                  {sickLeaves.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.start_date} – {l.end_date} ({l.days} nap)
                    </SelectItem>
                  ))}
                  <SelectItem value="__manual__">Egyéni időszak megadása...</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Manual date inputs (shown if manual select or accident) */}
          {(selectedLeaveId === '__manual__' || documentType === 'accident') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Kezdő dátum *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Befejező dátum *</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {selectedLeaveId === '__manual__' && documentType !== 'accident' && (
            <div className="space-y-1.5">
              <Label>Munkanapok száma</Label>
              <Input
                type="number"
                placeholder="pl. 5"
                value={days || ''}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </div>
          )}

          {/* Type specific fields: CSED / GYED */}
          {documentType === 'csed_gyed' && (
            <div className="space-y-4 border-t border-border pt-4 mt-2">
              <div className="space-y-1.5">
                <Label>Igényelt Ellátás Típusa</Label>
                <Select
                  value={benefitType}
                  onValueChange={(v) => setBenefitType(v as 'csed' | 'gyed')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csed">Csecsemőgondozási díj (CSED)</SelectItem>
                    <SelectItem value="gyed">Gyermekgondozási díj (GYED)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Gyermek neve *</Label>
                  <Input
                    placeholder="Gyermek teljes neve"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gyermek születési ideje *</Label>
                  <Input
                    type="date"
                    value={childBirthDate}
                    onChange={(e) => setChildBirthDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Várható szülés ideje (opcionális)</Label>
                  <Input
                    type="date"
                    value={expectedDateOfDelivery}
                    onChange={(e) => setExpectedDateOfDelivery(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ellátás kezdőnapja</Label>
                  <Input
                    type="date"
                    value={expectedStartDate}
                    placeholder="Alapértelmezett: távollét kezdete"
                    onChange={(e) => setExpectedStartDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Type specific fields: Pregnancy Sick Leave */}
          {documentType === 'pregnancy' && (
            <div className="space-y-4 border-t border-border pt-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Orvosi igazolás száma *</Label>
                  <Input
                    placeholder="pl. 12345/2026"
                    value={medicalCertNo}
                    onChange={(e) => setMedicalCertNo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nőgyógyász orvos neve *</Label>
                  <Input
                    placeholder="pl. Dr. Kiss János"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Várható szülés időpontja *</Label>
                <Input
                  type="date"
                  value={expectedDateOfDelivery}
                  onChange={(e) => setExpectedDateOfDelivery(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Type specific fields: Standard Sick Leave */}
          {documentType === 'sick' && (
            <div className="space-y-4 border-t border-border pt-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Orvosi igazolás száma (opcionális)</Label>
                  <Input
                    placeholder="pl. 12345/2026"
                    value={medicalCertNo}
                    onChange={(e) => setMedicalCertNo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kezelőorvos neve (opcionális)</Label>
                  <Input
                    placeholder="pl. Dr. Szabó Péter"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Type specific fields: Workplace Accident */}
          {documentType === 'accident' && (
            <div className="space-y-4 border-t border-border pt-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Baleset dátuma *</Label>
                  <Input
                    type="date"
                    value={accidentDate}
                    onChange={(e) => setAccidentDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Baleset időpontja *</Label>
                  <Input
                    type="time"
                    value={accidentTime}
                    onChange={(e) => setAccidentTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Baleset pontos helyszíne *</Label>
                <Input
                  placeholder="pl. Cég székhelye, szerelőcsarnok"
                  value={accidentLocation}
                  onChange={(e) => setAccidentLocation(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Baleset részletes leírása *</Label>
                <Input
                  placeholder="Hogyan történt a baleset..."
                  value={accidentDescription}
                  onChange={(e) => setAccidentDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Sérülés jellege / testrész *</Label>
                  <Input
                    placeholder="pl. Jobb csukló zúzódás"
                    value={injuryDetails}
                    onChange={(e) => setInjuryDetails(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Alkalmazott védőeszközök</Label>
                  <Input
                    placeholder="pl. védőkesztyű"
                    value={safetyEquipment}
                    onChange={(e) => setSafetyEquipment(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Szemtanúk adatai</Label>
                <Input
                  placeholder="pl. Nagy Imre (hegesztő)"
                  value={witnesses}
                  onChange={(e) => setWitnesses(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Common notes field */}
          <div className="space-y-1.5 border-t border-border pt-3">
            <Label>Munkáltatói Megjegyzés / Keltezési Megjegyzés</Label>
            <Input
              placeholder="Opcionális megjegyzés a nyomtatványhoz..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button onClick={handlePrint} disabled={!isFormValid()} className="gap-1.5">
            <Printer className="w-4 h-4" />
            Kitöltés és Nyomtatás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
