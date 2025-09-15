import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Plus, X } from 'lucide-react';
import NylasEmailConnect from '@/components/NylasEmailConnect';

interface Project {
  name: string;
  description: string;
}

const Onboarding = () => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    position: '',
    company: '',
  });
  const [projects, setProjects] = useState<Project[]>([{ name: '', description: '' }]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();


  const addProject = () => {
    setProjects([...projects, { name: '', description: '' }]);
  };

  const removeProject = (index: number) => {
    if (projects.length > 1) {
      setProjects(projects.filter((_, i) => i !== index));
    }
  };

  const updateProject = (index: number, field: keyof Project, value: string) => {
    const updatedProjects = [...projects];
    updatedProjects[index][field] = value;
    setProjects(updatedProjects);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          position: profile.position,
          company: profile.company,
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // Create projects
      const validProjects = projects.filter(p => p.name.trim());
      if (validProjects.length > 0) {
        const { error: projectsError } = await supabase
          .from('projects')
          .insert(
            validProjects.map(project => ({
              user_id: user.id,
              name: project.name,
              description: project.description,
            }))
          );

        if (projectsError) throw projectsError;
      }

      toast({
        title: "Profile completed!",
        description: "Welcome to your Invoice Management dashboard."
      });

      navigate('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Setup failed",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Set Up Your Invoice Categories</CardTitle>
          <CardDescription>
            Create projects to organize your invoices and expenses by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Profile Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    type="text"
                    placeholder="e.g. CEO, Manager, Accountant"
                    value={profile.position}
                    onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Enter your company name"
                  value={profile.company}
                  onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                />
              </div>
            </div>

            {/* Projects */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Invoice Categories</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProject}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Category
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Create categories to organize your invoices and expenses. Each category should represent a different type of project or expense area.
              </p>
              
              {projects.map((project, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Project {index + 1}</h4>
                      {projects.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProject(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`project-name-${index}`}>Category Name</Label>
                      <Input
                        id={`project-name-${index}`}
                        type="text"
                        placeholder="e.g. Marketing, Office Supplies, Travel"
                        value={project.name}
                        onChange={(e) => updateProject(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`project-description-${index}`}>Invoice Types</Label>
                      <Textarea
                        id={`project-description-${index}`}
                        placeholder="Describe what kinds of invoices/expenses belong to this category (e.g. advertising costs, social media tools, promotional materials)"
                        value={project.description}
                        onChange={(e) => updateProject(index, 'description', e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Email Integration */}
            <NylasEmailConnect />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting up...' : 'Complete Setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;