import { describe, it, expect } from 'vitest';

interface User {
  user_id: string;
  name: string;
  email: string;
  companies?: Array<{ id: string; name: string; role: string }>;
}

function filterUsers(allUsers: User[], searchUser: string): User[] {
  if (!allUsers) return [];
  if (!searchUser.trim()) return allUsers;
  const q = searchUser.toLowerCase();
  return allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.companies && u.companies.some(c => (c.name || '').toLowerCase().includes(q)))
  );
}

describe('ManagementDashboard user filtering', () => {
  const sampleUsers: User[] = [
    {
      user_id: 'u1',
      name: 'Berta Márton',
      email: 'marton.berta@hotmail.com',
      companies: [
        { id: 'c1', name: 'Alpha Kft', role: 'owner' },
        { id: 'c2', name: 'Test Kft', role: 'member' },
      ],
    },
    {
      user_id: 'u2',
      name: 'Mauroni Marco',
      email: 'marco@mauroni.com',
      companies: [
        { id: 'c3', name: 'Beta Zrt', role: 'admin' },
      ],
    },
    {
      user_id: 'u3',
      name: 'Teszt Munkavállaló',
      email: 'teszt@gmail.com',
      companies: [],
    },
  ];

  it('filters by user name', () => {
    const results = filterUsers(sampleUsers, 'Berta');
    expect(results).toHaveLength(1);
    expect(results[0].user_id).toBe('u1');
  });

  it('filters by email address', () => {
    const results = filterUsers(sampleUsers, 'mauroni.com');
    expect(results).toHaveLength(1);
    expect(results[0].user_id).toBe('u2');
  });

  it('filters by assigned company name', () => {
    const results = filterUsers(sampleUsers, 'Test Kft');
    expect(results).toHaveLength(1);
    expect(results[0].user_id).toBe('u1');
  });

  it('filters case-insensitively for partial company name', () => {
    const results = filterUsers(sampleUsers, 'beta');
    expect(results).toHaveLength(1);
    expect(results[0].user_id).toBe('u2');
  });

  it('returns empty array when no company, name, or email matches', () => {
    const results = filterUsers(sampleUsers, 'NonExistent Company');
    expect(results).toHaveLength(0);
  });
});
