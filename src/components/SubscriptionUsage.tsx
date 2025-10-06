import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, Zap } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useNavigate } from 'react-router-dom';

const SubscriptionUsage: React.FC = () => {
  const { 
    tier, 
    invoiceLimit, 
    invoicesUsed, 
    remainingInvoices, 
    periodEnd, 
    subscribed,
    openCustomerPortal 
  } = useSubscription();
  const navigate = useNavigate();

  const isUnlimited = tier === 'teszt' || invoiceLimit >= 999999;
  const usagePercentage = isUnlimited ? 0 : (invoicesUsed / invoiceLimit) * 100;
  
  const tierNames = {
    salmon: 'Salmon Trial',
    tuna: 'Tuna Plan',
    shark: 'Shark Plan',
    orca: 'Orca Plan',
    teszt: 'Teszt Unlimited'
  };

  const tierColors = {
    salmon: 'bg-green-500',
    tuna: 'bg-blue-500',
    shark: 'bg-purple-500',
    orca: 'bg-gradient-to-r from-yellow-400 to-orange-500',
    teszt: 'bg-cyan-500'
  };

  const handleManageSubscription = async () => {
    if (subscribed) {
      try {
        const portalUrl = await openCustomerPortal();
        window.open(portalUrl, '_blank');
      } catch (error) {
        console.error('Error opening customer portal:', error);
      }
    } else {
      navigate('/pricing');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('hu-HU');
  };

  const getProgressColor = () => {
    if (usagePercentage >= 90) return 'bg-red-500';
    if (usagePercentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${tierColors[tier]}`} />
            <CardTitle className="text-lg">{tierNames[tier]}</CardTitle>
            {!subscribed && tier === 'salmon' && (
              <Badge variant="secondary">Ingyenes</Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManageSubscription}
          >
            {subscribed ? 'Kezelés' : 'Frissítés'}
          </Button>
        </div>
        <CardDescription>
          Havi számlafeldolgozási limit és használat
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-1">
              <FileText className="h-4 w-4" />
              <span>Felhasznált számlák</span>
            </div>
            <span className="font-medium">
              {invoicesUsed} / {isUnlimited ? 'Korlátlan' : invoiceLimit}
            </span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{isUnlimited ? 'Korlátlan használat' : `${Math.round(usagePercentage)}% felhasználva`}</span>
            {!isUnlimited && (
              <span className="flex items-center space-x-1">
                <Zap className="h-3 w-3" />
                <span>{remainingInvoices} maradt</span>
              </span>
            )}
          </div>
        </div>

        {/* Period Information */}
        {periodEnd && (
          <div className="flex items-center justify-between text-sm p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Következő újratöltés:</span>
            </div>
            <span className="font-medium">
              {formatDate(periodEnd)}
            </span>
          </div>
        )}

        {/* Usage Warning */}
        {!isUnlimited && usagePercentage >= 80 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2 text-yellow-800">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">
                {usagePercentage >= 95 
                  ? 'Majdnem elérte a limitet!' 
                  : 'Közeledik a limithez!'
                }
              </span>
            </div>
            {usagePercentage >= 95 && (
              <p className="text-xs text-yellow-700 mt-1">
                Fontolja meg a csomag frissítését a további számlafeldolgozáshoz.
              </p>
            )}
          </div>
        )}

        {/* No usage remaining */}
        {!isUnlimited && remainingInvoices === 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 text-red-800">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">
                Elérte a havi limitet!
              </span>
            </div>
            <p className="text-xs text-red-700 mt-1">
              Frissítse csomagját vagy várjon a következő billing ciklusig.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionUsage;