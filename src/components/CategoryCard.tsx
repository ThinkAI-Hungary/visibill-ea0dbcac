import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, X, Plus } from 'lucide-react';

interface CategoryCardProps {
  name: string;
  description: string;
  isNew?: boolean;
  onUpdate: (name: string, description: string) => void;
  onRemove?: () => void;
  canRemove?: boolean;
}

export function CategoryCard({
  name,
  description,
  isNew = false,
  onUpdate,
  onRemove,
  canRemove = true
}: CategoryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editTags, setEditTags] = useState<string[]>(
    description ? description.split(',').map(t => t.trim()).filter(Boolean) : []
  );
  const [tagInput, setTagInput] = useState('');

  const tags = description ? description.split(',').map(t => t.trim()).filter(Boolean) : [];

  const handleAddTag = () => {
    if (tagInput.trim() && !editTags.includes(tagInput.trim())) {
      setEditTags([...editTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(t => t !== tagToRemove));
  };

  const handleSave = () => {
    onUpdate(editName, editTags.join(', '));
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(name);
    setEditTags(description ? description.split(',').map(t => t.trim()).filter(Boolean) : []);
    setIsEditing(false);
  };

  const openEdit = () => {
    setEditName(name);
    setEditTags(description ? description.split(',').map(t => t.trim()).filter(Boolean) : []);
    setIsEditing(true);
  };

  return (
    <>
      <Card className="group relative bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h4 className="font-semibold text-foreground truncate flex-1">
              {name || 'Új kategória'}
            </h4>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={openEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {canRemove && onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={onRemove}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {tags.length > 0 ? (
              tags.slice(0, 5).map((tag, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-xs bg-primary/10 text-primary border-0 hover:bg-primary/20"
                >
                  {tag}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">
                Nincs címke megadva
              </span>
            )}
            {tags.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 5}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditing} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border-border/50">
          <DialogHeader>
            <DialogTitle>{name ? 'Kategória szerkesztése' : 'Új kategória'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Kategória neve</Label>
              <Input
                id="category-name"
                placeholder="pl. Marketing, Irodai kellékek"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Címkék (számla típusok)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Új címke hozzáadása..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-background/50"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Nyomj Enter-t vagy kattints a + gombra a címke hozzáadásához
              </p>

              <div className="flex flex-wrap gap-2 mt-3 min-h-[32px] p-2 rounded-md bg-background/30 border border-border/30">
                {editTags.length > 0 ? (
                  editTags.map((tag, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-sm bg-primary/15 text-primary border-0 pr-1 gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic p-1">
                    Még nincs címke hozzáadva
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Mégse
            </Button>
            <Button type="button" onClick={handleSave}>
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
