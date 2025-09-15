import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Mail, CheckCircle, X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NylasToken {
  id: string;
  email_address: string;
  provider: string;
  created_at: string;
}

interface NylasEmailConnectProps {
  onConnectionUpdate?: () => void;
}

const NylasEmailConnect: React.FC<NylasEmailConnectProps> = ({ onConnectionUpdate }) => {
  const [connecting, setConnecting] = useState(false);
  const [tokens, setTokens] = useState<NylasToken[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchTokens();
    }
  }, [user]);

  const fetchTokens = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('nylas-auth', {
        body: { action: 'get_tokens' }
      });

      if (error) throw error;
      
      setTokens(data.tokens || []);
    } catch (error: any) {
      console.error('Error fetching tokens:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load connected email accounts"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!user) return;
    
    setConnecting(true);
    
    try {
      // Get authorization URL
      const { data, error } = await supabase.functions.invoke('nylas-auth', {
        body: { action: 'get_auth_url' }
      });

      if (error) throw error;

      // Open popup window for OAuth
      const popup = window.open(
        data.authUrl,
        'nylas-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for popup messages
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.success) {
          toast({
            title: "Email Connected!",
            description: `Successfully connected ${event.data.email}`
          });
          fetchTokens();
          onConnectionUpdate?.();
        } else if (event.data.error) {
          toast({
            variant: "destructive",
            title: "Connection Failed",
            description: event.data.error
          });
        }
        
        window.removeEventListener('message', handleMessage);
        popup?.close();
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed without completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

    } catch (error: any) {
      console.error('Error initiating OAuth:', error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: error.message
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (emailAddress: string) => {
    try {
      const { error } = await supabase.functions.invoke('nylas-auth', {
        body: { 
          action: 'disconnect',
          email_address: emailAddress
        }
      });

      if (error) throw error;

      toast({
        title: "Email Disconnected",
        description: `Disconnected ${emailAddress}`
      });
      
      fetchTokens();
      onConnectionUpdate?.();
    } catch (error: any) {
      console.error('Error disconnecting email:', error);
      toast({
        variant: "destructive",
        title: "Disconnection Error",
        description: error.message
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
            <span className="ml-2">Loading email connections...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Integration
        </CardTitle>
        <CardDescription>
          Connect your email accounts to automatically process invoice attachments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tokens.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Connected Accounts</h4>
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium">{token.email_address}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {token.provider}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Connected {new Date(token.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDisconnect(token.email_address)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <Button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full"
          variant={tokens.length > 0 ? "outline" : "default"}
        >
          {connecting ? (
            <>
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
              Connecting...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Connect Email Account
            </>
          )}
        </Button>
        
        {tokens.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Connect your email to automatically detect and process invoice attachments
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default NylasEmailConnect;