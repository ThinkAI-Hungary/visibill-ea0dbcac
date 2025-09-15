import NylasEmailConnect from "@/components/NylasEmailConnect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NylasTest() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Vissza a főoldalra
        </Button>
        
        <h1 className="text-3xl font-bold tracking-tight">Nylas Email Integráció Teszt</h1>
        <p className="text-muted-foreground">
          Teszteld a Nylas email integrációt és kapcsolj össze email fiókokat
        </p>
      </div>

      <div className="space-y-6">
        {/* Test Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Teszt Utasítások
            </CardTitle>
            <CardDescription>
              Így tesztelheted a Nylas email integrációt
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <h4 className="font-medium">1. Email fiók kapcsolása</h4>
              <p className="text-sm text-muted-foreground">
                Kattints az "Email fiók kapcsolása" gombra és válassz egy Gmail vagy más email szolgáltatót
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">2. OAuth folyamat</h4>
              <p className="text-sm text-muted-foreground">
                Egy popup ablak nyílik meg, ahol bejelenthetsz az email fiókodba
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">3. Engedélyek</h4>
              <p className="text-sm text-muted-foreground">
                Adj engedélyt a Visibill alkalmazásnak az email olvasására (csak olvasás)
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">4. Kapcsolat tesztelése</h4>
              <p className="text-sm text-muted-foreground">
                Sikeres kapcsolat után látni fogod a kapcsolt email címet az alábbi listában
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Nylas Integration Component */}
        <NylasEmailConnect />

        {/* Technical Details */}
        <Card>
          <CardHeader>
            <CardTitle>Technikai részletek</CardTitle>
            <CardDescription>
              A Nylas integráció működéséről
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Mit csinál a Nylas?</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Email fiókok biztonságos kapcsolása</li>
                  <li>• OAuth2 alapú hitelesítés</li>
                  <li>• Email mellékletek automatikus feldolgozása</li>
                  <li>• Számla dokumentumok keresése</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Támogatott szolgáltatók</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Gmail</li>
                  <li>• Outlook</li>
                  <li>• Yahoo Mail</li>
                  <li>• Exchange</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}