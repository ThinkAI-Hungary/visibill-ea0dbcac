import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function WorkingTimePage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Munkaidő</h2>
      </div>
      
      <Card className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-card/50 backdrop-blur-sm border-primary/20">
        <Clock className="w-16 h-16 text-primary mb-4 opacity-50" />
        <h3 className="text-2xl font-semibold text-foreground/80">Fejlesztés alatt!</h3>
        <p className="text-muted-foreground mt-2">
          Ez a funkció hamarosan elérhető lesz.
        </p>
      </Card>
    </div>
  );
}
