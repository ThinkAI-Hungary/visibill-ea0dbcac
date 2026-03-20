import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';

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
}

export function ProfileSection({ profile, setProfile, onSave, loading }: Props) {
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
            <Label htmlFor="name">Teljes név</Label>
            <Input id="name" value={profile.name} onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))} placeholder="Kovács János" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">Pozíció</Label>
            <Input id="position" value={profile.position} onChange={e => setProfile(prev => ({ ...prev, position: e.target.value }))} placeholder="Ügyvezető" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Cég neve</Label>
          <Input id="company" value={profile.company} onChange={e => setProfile(prev => ({ ...prev, company: e.target.value }))} placeholder="Példa Kft." />
        </div>
        <Button onClick={onSave} disabled={loading}>Profil mentése</Button>
      </CardContent>
    </Card>
  );
}
