import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Building, Briefcase } from 'lucide-react';
import type { Profile } from '@/hooks/useDashboardData';

interface ProfileSummaryProps {
  profile: Profile | undefined;
  email: string | undefined;
}

const ProfileSummary = React.memo(function ProfileSummary({ profile, email }: ProfileSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profil információk
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="text-lg">
              {profile?.name?.split(' ').map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2 flex-1">
            <h3 className="text-xl font-semibold">{profile?.name}</h3>
            <div className="flex flex-wrap gap-2">
              {profile?.position && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {profile.position}
                </Badge>
              )}
              {profile?.company && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {profile.company}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default ProfileSummary;
