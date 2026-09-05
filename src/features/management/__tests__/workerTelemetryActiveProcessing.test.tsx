import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerPanel } from '../components/worker/WorkerPanel';
import { fetchManagementData } from '../api/managementApi';

vi.mock('../api/managementApi', () => ({
  fetchManagementData: vi.fn(),
  postManagementData: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/errorReporter', () => ({
  reportError: vi.fn(),
}));

describe('Worker Telemetry Active Processing for GL and Accounty pipelines', () => {
  it('correctly displays active processing jobs for gl_upload_notifications and accounty_uploads', async () => {
    const mockDataWithActiveProcessing = {
      containers: [
        {
          container_name: 'worker-prod-1',
          host_ip: '10.0.0.1',
          supabase_project: 'PROD',
          started_at: new Date(Date.now() - 3600000).toISOString(),
          last_heartbeat: new Date().toISOString(),
          is_healthy: true,
          uptime_seconds: 3600,
          version: 'v1.4.0',
          active_queues: ['gl_classification_jobs', 'accounty_jobs'],
          cpu_usage: 20,
          ram_usage: 40,
          jobs_24h: 50,
          avg_duration_ms: 1000,
          total_cost_24h: 1.25,
        },
      ],
      queues: [],
      pipelines: [],
      recent_jobs: [],
      error_jobs: [],
      active_processing: [
        {
          id: 'gl-proc-1',
          file_name: 'AI átsorolás indítva (42 tétel)',
          company_name: 'Test GL Partner',
          company_id: 'comp-1',
          pipeline_type: 'gl_journal',
          started_at: new Date(Date.now() - 15000).toISOString(),
          created_at: new Date(Date.now() - 15000).toISOString(),
          document_category: 'general_ledger',
          source: 'gl_upload_notifications',
          elapsed_sec: 15,
          project: 'PROD',
        },
        {
          id: 'acc-proc-1',
          file_name: 'banki_kivonat_2026.pdf',
          company_name: 'Test Accounty Client',
          company_id: 'comp-2',
          pipeline_type: 'accounty',
          started_at: new Date(Date.now() - 30000).toISOString(),
          created_at: new Date(Date.now() - 30000).toISOString(),
          document_category: 'accounty_upload',
          source: 'accounty_uploads',
          elapsed_sec: 30,
          project: 'PROD',
        },
      ],
      summary: {
        healthy_containers: 1,
        total_containers: 1,
        total_queue_pending: 0,
        total_processing: 2,
        total_jobs_24h: 50,
        total_cost_24h: 1.25,
        total_errors_24h: 0,
      },
    };

    vi.mocked(fetchManagementData).mockResolvedValue(mockDataWithActiveProcessing);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/?wrk_show_processing=true']}>
          <WorkerPanel />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expect the active processing jobs to be displayed in the UI
    expect(await screen.findByText('AI átsorolás indítva (42 tétel)')).toBeInTheDocument();
    expect(await screen.findByText('banki_kivonat_2026.pdf')).toBeInTheDocument();
    expect(screen.getByText('Test GL Partner')).toBeInTheDocument();
    expect(screen.getByText('Test Accounty Client')).toBeInTheDocument();
  });
});
