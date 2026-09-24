import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChangelogEntryCard } from '@/components/changelog/ChangelogEntryCard';
import { ChangelogTimeline } from '@/components/changelog/ChangelogTimeline';
import type { ChangelogEntry } from '@/types/changelog';

const mockEntries: ChangelogEntry[] = [
  {
    id: 'entry-1',
    version: 'v2.2.5',
    release_date: '2026-09-24',
    title: 'Könyvelőirodai hibajegy megosztás és szakmai kategóriák',
    summary: 'Megkönnyítettük a könyvelőirodák csapatmunkáját: közös hibajegyek a kezelt cégeknél.',
    category: 'feature',
    app_scope: 'all',
    items: [
      { type: 'new', title: 'Közös hozzáférés', description: 'Az iroda tagjai látják egymás jegyeit.' },
      { type: 'perf', title: 'Cégkereső mező', description: 'Gyors szűrés a kezelt ügyfélcégekre.' },
    ],
    is_published: true,
    created_at: '2026-09-24T10:00:00Z',
    updated_at: '2026-09-24T10:00:00Z',
  },
  {
    id: 'entry-2',
    version: 'v2.2.4',
    release_date: '2026-09-23',
    title: 'Aggreg8 PSD2 Open Banking integráció',
    summary: 'Automatikus bankszámlatörténet szinkronizáció.',
    category: 'improvement',
    app_scope: 'eaisybooks',
    items: [
      { type: 'fix', title: 'Árfolyam stabilitás', description: 'Valós idejű MNB árfolyam számítás.' },
    ],
    is_published: true,
    created_at: '2026-09-23T10:00:00Z',
    updated_at: '2026-09-23T10:00:00Z',
  },
];

describe('Changelog Components', () => {
  it('renders ChangelogEntryCard with title, version, badges and items without emojis', () => {
    render(<ChangelogEntryCard entry={mockEntries[0]} />);

    expect(screen.getByText('Könyvelőirodai hibajegy megosztás és szakmai kategóriák')).toBeInTheDocument();
    expect(screen.getByText('v2.2.5')).toBeInTheDocument();
    expect(screen.getByText('Új funkció')).toBeInTheDocument();
    expect(screen.getByText('Minden modul')).toBeInTheDocument();
    expect(screen.getByText('Közös hozzáférés:')).toBeInTheDocument();
    expect(screen.getByText('Az iroda tagjai látják egymás jegyeit.')).toBeInTheDocument();
  });

  it('renders ChangelogTimeline with entries and active date highlights', () => {
    render(<ChangelogTimeline entries={mockEntries} />);

    expect(screen.getByText('Könyvelőirodai hibajegy megosztás és szakmai kategóriák')).toBeInTheDocument();
    expect(screen.getByText('Aggreg8 PSD2 Open Banking integráció')).toBeInTheDocument();
  });

  it('renders empty state when entries list is empty', () => {
    render(<ChangelogTimeline entries={[]} />);

    expect(screen.getByText('Nincs találat a megadott szűrésre')).toBeInTheDocument();
  });
});
