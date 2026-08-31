import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatFileSize } from '@/lib/utils';
import type { ChannelConfig, SelectedFileItem } from '../../types';

interface UploadFileItemProps {
  item: SelectedFileItem;
  index: number;
  config: ChannelConfig;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export function UploadFileItem({
  item,
  index,
  config,
  onRemove,
  disabled,
}: UploadFileItemProps) {
  const { file } = item;
  const Icon = config.icon;

  const fileExt = file.name.split('.').pop()?.toUpperCase() || 'FÁJL';
  const badgeLabel = file.type ? file.type.split('/')[1]?.toUpperCase() || fileExt : fileExt;

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate" title={file.name}>
            {file.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {badgeLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(index)}
        disabled={disabled}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
        title="Fájl eltávolítása"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
