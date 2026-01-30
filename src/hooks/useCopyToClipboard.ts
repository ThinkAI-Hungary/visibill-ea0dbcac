import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

interface UseCopyToClipboardReturn {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
}

export function useCopyToClipboard(): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (!navigator?.clipboard) {
      toast({
        title: "Hiba",
        description: "Nem sikerült másolni - a vágólap nem elérhető.",
        variant: "destructive",
      });
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Másolva",
        description: "Az érték a vágólapra került.",
      });
      
      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (error) {
      toast({
        title: "Hiba",
        description: "Nem sikerült másolni a vágólapra.",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  return { copy, copied };
}
