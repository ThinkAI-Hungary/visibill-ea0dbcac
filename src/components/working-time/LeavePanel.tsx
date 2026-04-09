import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarOff,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Palmtree,
  Thermometer,
  UserRound,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO, differenceInBusinessDays, addDays } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useLeaveRequests,
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  type LeaveType,
  type LeaveRequest,
} from '@/hooks/useLeaveRequests';
import { useUserRole } from '@/hooks/useUserRole';

const LEAVE_TYPE_ICONS: Record<LeaveType, React.ReactNode> = {
  vacation: <Palmtree className="h-3.5 w-3.5" />,
  sick: <Thermometer className="h-3.5 w-3.5" />,
  personal: <UserRound className="h-3.5 w-3.5" />,
  other: <HelpCircle className="h-3.5 w-3.5" />,
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
  approved: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  rejected: 'bg-red-500/15 text-red-500 border-red-500/20',
};

export function LeavePanel() {
  const { isAdmin } = useUserRole();
  const {
    myRequests,
    pendingRequests,
    leaveRequests,
    createMutation,
    reviewMutation,
    deleteMutation,
  } = useLeaveRequests();

  const [showForm, setShowForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [showPending, setShowPending] = useState(true);

  const handleSubmit = () => {
    if (!startDate || !endDate) return;
    createMutation.mutate(
      {
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        note: note || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setStartDate('');
          setEndDate('');
          setNote('');
          setLeaveType('vacation');
        },
      }
    );
  };

  const getBusinessDays = (start: string, end: string) => {
    return differenceInBusinessDays(addDays(parseISO(end), 1), parseISO(start));
  };

  return (
    <div className="space-y-4">
      {/* New request button / form */}
      {!showForm ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Új távolléti kérelem
        </Button>
      ) : (
        <Card className="rounded-xl border-primary/30 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <CalendarOff className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Új távolléti kérelem</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Type */}
              <Select
                value={leaveType}
                onValueChange={(v) => setLeaveType(v as LeaveType)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]
                  ).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      <span className="flex items-center gap-2">
                        {LEAVE_TYPE_ICONS[val]} {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Start */}
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || e.target.value > endDate)
                    setEndDate(e.target.value);
                }}
                className="h-9"
              />

              {/* End */}
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="h-9"
              />

              {/* Note */}
              <Input
                placeholder="Megjegyzés (opcionális)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-9"
              />
            </div>

            {startDate && endDate && (
              <p className="text-xs text-muted-foreground">
                {getBusinessDays(startDate, endDate)} munkanap
              </p>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={
                  !startDate || !endDate || createMutation.isPending
                }
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CalendarOff className="h-4 w-4 mr-1" />
                )}
                Beküldés
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Mégse
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My requests */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Saját kérelmeim
        </h3>
        {myRequests.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 py-2">
            Nincs beküldött kérelem.
          </p>
        ) : (
          myRequests.map((req) => (
            <LeaveRequestRow
              key={req.id}
              request={req}
              showEmployee={false}
              onDelete={
                req.status === 'pending'
                  ? () => deleteMutation.mutate(req.id)
                  : undefined
              }
              isDeleting={deleteMutation.isPending}
            />
          ))
        )}
      </div>

      {/* Admin: pending requests from others */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="space-y-2">
          <button
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPending(!showPending)}
          >
            {showPending ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Jóváhagyásra váró ({pendingRequests.length})
          </button>

          {showPending &&
            pendingRequests.map((req) => (
              <LeaveRequestRow
                key={req.id}
                request={req}
                showEmployee
                onApprove={() =>
                  reviewMutation.mutate({ id: req.id, status: 'approved' })
                }
                onReject={() =>
                  reviewMutation.mutate({ id: req.id, status: 'rejected' })
                }
                isReviewing={reviewMutation.isPending}
              />
            ))}
        </div>
      )}
    </div>
  );
}

/** Single leave request row */
function LeaveRequestRow({
  request,
  showEmployee,
  onApprove,
  onReject,
  onDelete,
  isReviewing,
  isDeleting,
}: {
  request: LeaveRequest;
  showEmployee: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onDelete?: () => void;
  isReviewing?: boolean;
  isDeleting?: boolean;
}) {
  const days = differenceInBusinessDays(
    addDays(parseISO(request.end_date), 1),
    parseISO(request.start_date)
  );
  const typeIcon = LEAVE_TYPE_ICONS[request.leave_type];
  const statusStyle = STATUS_STYLES[request.status];

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5 text-sm">
      {/* Type icon */}
      <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
        {typeIcon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showEmployee && (
            <span className="font-semibold">{request.employee_name}</span>
          )}
          <span className="text-muted-foreground">
            {LEAVE_TYPE_LABELS[request.leave_type]}
          </span>
          <span className="text-xs text-muted-foreground/70">•</span>
          <span className="text-xs tabular-nums">
            {format(parseISO(request.start_date), 'MMM d.', { locale: hu })}
            {request.start_date !== request.end_date && (
              <>
                {' – '}
                {format(parseISO(request.end_date), 'MMM d.', { locale: hu })}
              </>
            )}
          </span>
          <Badge variant="outline" className="text-[10px] h-4 px-1 tabular-nums">
            {days} nap
          </Badge>
        </div>
        {request.note && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
            {request.note}
          </p>
        )}
      </div>

      {/* Status badge */}
      <Badge variant="outline" className={cn('text-xs shrink-0', statusStyle)}>
        {LEAVE_STATUS_LABELS[request.status]}
      </Badge>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {onApprove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
            onClick={onApprove}
            disabled={isReviewing}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Elfogad
          </Button>
        )}
        {onReject && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={onReject}
            disabled={isReviewing}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Elutasít
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
