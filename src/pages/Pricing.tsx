import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Zap, Star, Crown, Gem } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { toast } from 'sonner';

// Pricing data structure with all your Stripe products
const pricingData = {
  salmon: {
    name: 'Salmon Trial',
    description: 'Ingyenes próba verzió',
    icon: Zap,
    color: 'bg-green-500',
    invoiceLimit: 3,
    features: [
      '3 számla havonta',
      'Alapvető elemzések',
      'Email támogatás'
    ],
    prices: {
      monthly: { amount: 0, priceId: null },
      yearly: { amount: 0, priceId: null }
    }
  },
  tuna: {
    name: 'Tuna Plan',
    description: 'Kisvállalkozásoknak',
    icon: Star,
    color: 'bg-blue-500',
    invoiceLimits: [25, 50, 75, 150, 300, 500],
    features: [
      'Korlátlan számla feldolgozás',
      'Fejlett elemzések',
      'Prioritás támogatás',
      'API hozzáférés'
    ],
    prices: {
      monthly: [
        { limit: 25, amount: 9990, priceId: 'price_tuna_25_monthly' },
        { limit: 50, amount: 19990, priceId: 'price_tuna_50_monthly' },
        { limit: 75, amount: 29990, priceId: 'price_tuna_75_monthly' },
        { limit: 150, amount: 49990, priceId: 'price_tuna_150_monthly' },
        { limit: 300, amount: 79990, priceId: 'price_tuna_300_monthly' },
        { limit: 500, amount: 119990, priceId: 'price_tuna_500_monthly' }
      ],
      yearly: [
        { limit: 25, amount: 99990, priceId: 'price_tuna_25_yearly' },
        { limit: 50, amount: 199990, priceId: 'price_tuna_50_yearly' },
        { limit: 75, amount: 299990, priceId: 'price_tuna_75_yearly' },
        { limit: 150, amount: 499990, priceId: 'price_tuna_150_yearly' },
        { limit: 300, amount: 799990, priceId: 'price_tuna_300_yearly' },
        { limit: 500, amount: 1199990, priceId: 'price_tuna_500_yearly' }
      ]
    }
  },
  shark: {
    name: 'Shark Plan',
    description: 'Közepes vállalkozásoknak',
    icon: Crown,
    color: 'bg-purple-500',
    invoiceLimits: [25, 50, 75, 150, 300, 500],
    features: [
      'Minden Tuna funkció',
      'Egyedi integrációk',
      'Dedikált fiókkezelő',
      'SLA garancia'
    ],
    prices: {
      monthly: [
        { limit: 25, amount: 19990, priceId: 'price_shark_25_monthly' },
        { limit: 50, amount: 39990, priceId: 'price_shark_50_monthly' },
        { limit: 75, amount: 59990, priceId: 'price_shark_75_monthly' },
        { limit: 150, amount: 99990, priceId: 'price_shark_150_monthly' },
        { limit: 300, amount: 159990, priceId: 'price_shark_300_monthly' },
        { limit: 500, amount: 239990, priceId: 'price_shark_500_monthly' }
      ],
      yearly: [
        { limit: 25, amount: 199990, priceId: 'price_shark_25_yearly' },
        { limit: 50, amount: 399990, priceId: 'price_shark_50_yearly' },
        { limit: 75, amount: 599990, priceId: 'price_shark_75_yearly' },
        { limit: 150, amount: 999990, priceId: 'price_shark_150_yearly' },
        { limit: 300, amount: 1599990, priceId: 'price_shark_300_yearly' },
        { limit: 500, amount: 2399990, priceId: 'price_shark_500_yearly' }
      ]
    }
  },
  orca: {
    name: 'Orca Plan',
    description: 'Nagyvállalatok számára',
    icon: Gem,
    color: 'bg-gradient-to-r from-yellow-400 to-orange-500',
    invoiceLimits: [25, 50, 75, 150, 300, 500],
    features: [
      'Minden Shark funkció',
      'Teljes testreszabás',
      '24/7 prémium támogatás',
      'Egyedi fejlesztések'
    ],
    prices: {
      monthly: [
        { limit: 25, amount: 39990, priceId: 'price_orca_25_monthly' },
        { limit: 50, amount: 79990, priceId: 'price_orca_50_monthly' },
        { limit: 75, amount: 119990, priceId: 'price_orca_75_monthly' },
        { limit: 150, amount: 199990, priceId: 'price_orca_150_monthly' },
        { limit: 300, amount: 319990, priceId: 'price_orca_300_monthly' },
        { limit: 500, amount: 479990, priceId: 'price_orca_500_monthly' }
      ],
      yearly: [
        { limit: 25, amount: 399990, priceId: 'price_orca_25_yearly' },
        { limit: 50, amount: 799990, priceId: 'price_orca_50_yearly' },
        { limit: 75, amount: 1199990, priceId: 'price_orca_75_yearly' },
        { limit: 150, amount: 1999990, priceId: 'price_orca_150_yearly' },
        { limit: 300, amount: 3199990, priceId: 'price_orca_300_yearly' },
        { limit: 500, amount: 4799990, priceId: 'price_orca_500_yearly' }
      ]
    }
  }
};

const Pricing: React.FC = () => {
  const { tier, createCheckout, openCustomerPortal, subscribed } = useSubscription();
  const [billingPeriod, setBillingPeriod] = React.useState<'monthly' | 'yearly'>('monthly');
  const [selectedVolumes, setSelectedVolumes] = React.useState<Record<string, number>>({});

  const handleSubscribe = async (planKey: string) => {
    const selectedVolume = selectedVolumes[planKey];
    if (!selectedVolume && planKey !== 'salmon') {
      toast.error('Kérjük válasszon számla mennyiséget');
      return;
    }

    const plan = pricingData[planKey as keyof typeof pricingData];
    if (planKey === 'salmon' || !('invoiceLimits' in plan)) return;

    const volumeIndex = plan.invoiceLimits.indexOf(selectedVolume);
    const prices = plan.prices[billingPeriod];
    const priceData = Array.isArray(prices) ? prices[volumeIndex] : null;
    
    if (!priceData?.priceId) {
      toast.error('Hiba történt az árazási információk betöltésekor');
      return;
    }

    try {
      const checkoutUrl = await createCheckout(priceData.priceId);
      window.open(checkoutUrl, '_blank');
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Hiba történt a fizetés indításakor');
    }
  };

  const handleManageSubscription = async () => {
    try {
      const portalUrl = await openCustomerPortal();
      window.open(portalUrl, '_blank');
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Hiba történt az előfizetés kezelés megnyitásakor');
    }
  };

  const handleVolumeChange = (planKey: string, volume: string) => {
    setSelectedVolumes(prev => ({
      ...prev,
      [planKey]: parseInt(volume)
    }));
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Válassza ki az Ön számára megfelelő csomagot</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Minden méretű vállalkozás számára kínálunk megoldást
        </p>
        
        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center space-x-2 mb-8">
          <span className={billingPeriod === 'monthly' ? 'font-semibold' : 'text-muted-foreground'}>
            Havi
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
            className="relative"
          >
            <div className={`w-12 h-6 rounded-full ${billingPeriod === 'yearly' ? 'bg-primary' : 'bg-muted'} transition-colors`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-0.5'} translate-y-0.5`} />
            </div>
          </Button>
          <span className={billingPeriod === 'yearly' ? 'font-semibold' : 'text-muted-foreground'}>
            Éves
          </span>
          {billingPeriod === 'yearly' && (
            <Badge variant="secondary" className="ml-2">
              2 hónap ingyen!
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(pricingData).map(([planKey, plan]) => {
          const Icon = plan.icon;
          const isCurrentPlan = tier === planKey;
          const isFree = planKey === 'salmon';
          
          return (
            <Card key={planKey} className={`relative ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}>
              {isCurrentPlan && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                  Jelenlegi csomag
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <div className={`w-12 h-12 rounded-full ${plan.color} flex items-center justify-center mx-auto mb-4`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {isFree ? (
                  <div className="text-center">
                    <div className="text-3xl font-bold">Ingyenes</div>
                    <div className="text-sm text-muted-foreground">
                      {'invoiceLimit' in plan ? `${plan.invoiceLimit} számla/hó` : 'Ingyenes'}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Volume Selection Dropdown */}
                    {'invoiceLimits' in plan && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Számla mennyiség/hó:
                        </label>
                        <Select 
                          value={selectedVolumes[planKey]?.toString() || ''} 
                          onValueChange={(value) => handleVolumeChange(planKey, value)}
                        >
                          <SelectTrigger className="w-full bg-background border-border">
                            <SelectValue placeholder="Válasszon mennyiséget" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border-border z-50">
                            {plan.invoiceLimits.map((limit, index) => {
                              const prices = plan.prices[billingPeriod];
                              const price = Array.isArray(prices) ? prices[index] : null;
                              
                              if (!price) return null;
                              
                              return (
                                <SelectItem key={limit} value={limit.toString()} className="hover:bg-muted">
                                  <div className="flex items-center justify-between w-full">
                                    <span>{limit} számla</span>
                                    <span className="ml-4 font-semibold">
                                      {formatPrice(price.amount)}/{billingPeriod === 'monthly' ? 'hó' : 'év'}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  {isFree ? (
                    <Button 
                      className="w-full" 
                      variant={isCurrentPlan ? "default" : "outline"}
                      disabled={isCurrentPlan}
                    >
                      {isCurrentPlan ? 'Aktív csomag' : 'Ingyenes kezdés'}
                    </Button>
                  ) : isCurrentPlan && subscribed ? (
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={handleManageSubscription}
                    >
                      Előfizetés kezelése
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleSubscribe(planKey)}
                      disabled={!selectedVolumes[planKey] && planKey !== 'salmon'}
                    >
                      Előfizetek
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Pricing;