import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, ChevronRight, Check, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUpsertTaxProfile } from '@/hooks/accounty';

const QUESTIONS = [
  { id: 1, question: 'KIVA-alany?', hint: 'Ha igen → KIVA-modul (11. fejezet), NEM TAO', options: ['Igen', 'Nem'] },
  { id: 2, question: 'Magánszemély EV (nem egyéni cég)?', hint: 'Ha igen → SZJA-modul, NEM TAO', options: ['Igen', 'Nem'] },
  { id: 3, question: 'Belföldi vagy külföldi személy?', hint: 'A Tao tv. 2.§ szerint', options: ['Belföldi', 'Külföldi'] },
  { id: 4, question: 'Nonprofit GFO-kód?', hint: 'Közhasznú jogállás meghatározza a mentességi küszöböt', options: ['Közhasznú nonprofit', 'Nem közhasznú nonprofit', 'Nem nonprofit'] },
  { id: 5, question: 'Csoporttagság?', hint: '≥75% szavazati jog, azonos fordulónap → csoportos TAO (2/A.§)', options: ['Igen, csoporttag', 'Nem csoporttag'] },
];

export default function TaoSetupWizardPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const navigate = useNavigate();
  const { toast } = useToast();
  const upsertTaxProfile = useUpsertTaxProfile();

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const handleApply = async () => {
    if (!id) return;
    const result = getResult();
    
    const isKiva = result.type === 'KIVA';
    const isKata = result.type === 'SZJA' && answers[2] === 'Igen';
    const taxGroup = result.type === 'KIVA' ? 'KIVA' :
                     result.type === 'SZJA' ? 'SZJA' :
                     result.type.startsWith('Nonprofit') ? 'Nonprofit' :
                     result.type === 'Külföldi vállalkozó' ? 'Külföldi' : 'TAO';

    try {
      await upsertTaxProfile.mutateAsync({
        companyId: id,
        isKiva,
        isKata,
        taxGroup
      });
      
      toast({
        title: 'Adóalany-státusz sikeresen beállítva',
        description: `Új besorolás: ${result.type} (${result.regime})`
      });
      
      navigate(`/accounty/${id}/${dateRange}/tao`);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Hiba a mentés során',
        description: err.message || 'Ismeretlen hiba történt.'
      });
    }
  };

  const handleAnswer = (questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    // Auto-advance to next question
    if (currentStep < QUESTIONS.length - 1) {
      setTimeout(() => setCurrentStep(prev => prev + 1), 300);
    }
  };

  const isComplete = Object.keys(answers).length >= QUESTIONS.length;

  // Determine result based on answers
  const getResult = () => {
    if (answers[1] === 'Igen') return { type: 'KIVA', regime: 'KIVA-modul', color: 'orange' };
    if (answers[2] === 'Igen') return { type: 'SZJA', regime: 'SZJA-modul', color: 'red' };
    if (answers[3] === 'Külföldi') return { type: 'Külföldi vállalkozó', regime: 'Külföldi telephely jövedelem', color: 'blue' };
    if (answers[4] === 'Közhasznú nonprofit') return { type: 'Nonprofit (A)', regime: '15% mentességi küszöb', color: 'purple' };
    if (answers[4] === 'Nem közhasznú nonprofit') return { type: 'Nonprofit (B)', regime: '10% mentesség, max 10M Ft', color: 'purple' };
    return { type: 'Általános', regime: 'Általános 6.§ adóalap', color: 'emerald' };
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to={`/accounty/${id}/${dateRange}/tao`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/25">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Adóalany-státusz Wizard</h1>
          <p className="text-sm text-slate-500">A Tao tv. 2.§ döntési fa szerinti besorolás</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {QUESTIONS.map((q, i) => (
          <React.Fragment key={q.id}>
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              i < currentStep ? 'bg-emerald-500 text-white' :
              i === currentStep ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 ring-2 ring-amber-400' :
              'bg-slate-100 dark:bg-slate-800 text-slate-400'
            )}>
              {answers[q.id] ? <Check className="w-4 h-4" /> : q.id}
            </div>
            {i < QUESTIONS.length - 1 && (
              <div className={cn('flex-1 h-0.5', i < currentStep ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700')} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Current question */}
      {!isComplete && (
        <div className="bg-card rounded-xl border border-border p-8 shadow-soft">
          <div className="text-center space-y-4">
            <span className="text-xs font-medium text-slate-400">Kérdés {currentStep + 1} / {QUESTIONS.length}</span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {QUESTIONS[currentStep].question}
            </h2>
            <p className="text-sm text-slate-500 flex items-center justify-center gap-1.5">
              <HelpCircle className="w-4 h-4" />
              {QUESTIONS[currentStep].hint}
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              {QUESTIONS[currentStep].options.map(opt => (
                <Button
                  key={opt}
                  variant={answers[QUESTIONS[currentStep].id] === opt ? 'default' : 'outline'}
                  onClick={() => handleAnswer(QUESTIONS[currentStep].id, opt)}
                  className={cn(
                    'px-8 py-3 text-sm',
                    answers[QUESTIONS[currentStep].id] === opt && 'bg-emerald-600 hover:bg-emerald-700'
                  )}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {isComplete && (() => {
        const result = getResult();
        return (
          <div className="bg-card rounded-xl border border-border p-8 shadow-soft text-center space-y-4">
            <div className={cn(
              'w-16 h-16 rounded-full mx-auto flex items-center justify-center',
              `bg-${result.color}-100 dark:bg-${result.color}-900/30`
            )}>
              <Shield className={cn('w-8 h-8', `text-${result.color}-600`)} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Besorolás: {result.type}
            </h2>
            <p className="text-sm text-slate-500">{result.regime}</p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button variant="outline" onClick={() => { setCurrentStep(0); setAnswers({}); }} disabled={upsertTaxProfile.isPending}>
                Újrakezdés
              </Button>
              <Button 
                onClick={handleApply}
                disabled={upsertTaxProfile.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {upsertTaxProfile.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Alkalmazás
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Answers summary */}
      {Object.keys(answers).length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Válaszok</h3>
          <div className="space-y-2">
            {QUESTIONS.filter(q => answers[q.id]).map(q => (
              <div key={q.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{q.question}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{answers[q.id]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
