import React, { createContext, useContext, useState } from 'react';

type AccountyRole = 'admin' | 'könyvelő';

interface AccountyRoleContextType {
  role: AccountyRole;
  setRole: (role: AccountyRole) => void;
}

const AccountyRoleContext = createContext<AccountyRoleContextType | undefined>(undefined);

export function useAccountyRole() {
  const ctx = useContext(AccountyRoleContext);
  if (!ctx) throw new Error('useAccountyRole must be used within AccountyRoleProvider');
  return ctx;
}

export function AccountyRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AccountyRole>('admin');
  return (
    <AccountyRoleContext.Provider value={{ role, setRole }}>
      {children}
    </AccountyRoleContext.Provider>
  );
}
