import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock } from 'lucide-react';

interface Profile {
  name: string;
  company: string;
  position: string;
  avatar_url: string;
}

interface Props {
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  onSave: () => void;
  loading: boolean;
  /** When provided, these fields become read-only and show the override values */
  readOnlyOverrides?: {
    position?: string;
    company?: string;
  };
}

export function ProfileSection({ profile, setProfile, onSave, loading, readOnlyOverrides }: Props) {
  const positionOverride = readOnlyOverrides?.position;
  const companyOverride = readOnlyOverrides?.company;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Felhasználói profil
        </CardTitle>
        <CardDescription>Személyes információk és avatar kezelése</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-1.5">Teljes név</Label>
            <Input id="name" value={profile.name} onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))} placeholder="Kovács János" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="position" className="flex items-center gap-1.5">
              Pozíció
              {positionOverride && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            {positionOverride ? (
              <Input
                id="position"
                value={positionOverride}
                disabled
                className="bg-muted/50 cursor-not-allowed"
                title="A pozíció a szerepkörből származik"
              />
            ) : (
              <Input id="position" value={profile.position} onChange={e => setProfile(prev => ({ ...prev, position: e.target.value }))} placeholder="Ügyvezető" />
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company" className="flex items-center gap-1.5">
            Cég neve
            {companyOverride && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          {companyOverride ? (
            <Input
              id="company"
              value={companyOverride}
              disabled
              className="bg-muted/50 cursor-not-allowed"
              title="A cég neve a kiválasztott cégből származik"
            />
          ) : (
            <Input id="company" value={profile.company} onChange={e => setProfile(prev => ({ ...prev, company: e.target.value }))} placeholder="Példa Kft." />
          )}
        </div>
        <Button onClick={onSave} disabled={loading}>Profil mentése</Button>
      </CardContent>
    </Card>
  );
}
