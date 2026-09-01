import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerPanel } from '../components/worker/WorkerPanel';
import { ContainerMetricsCard } from '../components/worker/ContainerMetricsCard';
import { QueueMonitorGrid } from '../components/worker/QueueMonitorGrid';
import { PipelineStatusList } from '../components/worker/PipelineStatusList';
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

const mockWorkerData = {
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
      active_queues: ['invoice_jobs', 'transaction_jobs'],
      cpu_usage: 24,
      ram_usage: 45,
      jobs_24h: 120,
      avg_duration_ms: 1500,
      total_cost_24h: 3.45,
    },
  ],
  queues: [
    {
      queue_name: 'invoice_jobs',
      project: 'PROD',
      queue_length: 3,
      total_messages: 150,
      pending_items: [
        {
          msg_id: 'msg-1',
          file_name: 'test_invoice.pdf',
          company_name: 'Acme Corp',
          enqueued_at: new Date(Date.now() - 60000).toISOString(),
          source: 'upload',
          document_category: 'invoice',
        },
      ],
    },
  ],
  pipelines: [
    {
      pipeline: 'invoice',
      project: 'PROD',
      jobs_24h: 80,
      avg_duration_ms: 1200,
      total_cost_usd: 2.15,
      error_count_24h: 0,
      daily_counts: [10, 12, 15, 8, 14, 11, 10],
    },
  ],
  recent_jobs: [
    {
      id: 'job-1',
      upload_id: 'up-1',
      created_at: new Date().toISOString(),
      pipeline: 'invoice',
      file_name: 'test_invoice.pdf',
      company_name: 'Acme Corp',
      model_name: 'gemini-2.0-flash',
      total_tokens: 1200,
      estimated_cost_usd: 0.0025,
      processing_duration_ms: 1100,
      worker_id: 'worker-prod-1',
      project: 'PROD',
      status: 'OK',
    },
  ],
  error_jobs: [
    {
      id: 'err-1',
      upload_id: 'up-err-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      file_name: 'corrupted_file.pdf',
      company_name: 'Beta Ltd',
      pipeline: 'invoice',
      error_message: 'Vision parsing failed: unreadable PDF stream',
      source: 'invoice_uploads',
      project: 'PROD',
      status: 'ERROR',
      estimated_cost_usd: 0.001,
      worker_id: 'worker-prod-1',
      processing_duration_ms: 800,
    },
  ],
  active_processing: [],
  summary: {
    healthy_containers: 1,
    total_containers: 1,
    total_queue_pending: 3,
    total_processing: 0,
    total_jobs_24h: 120,
    total_cost_24h: 3.45,
    total_errors_24h: 1,
  },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement, initialRoute = '/management?tab=worker') {
  const queryClient = createTestQueryClient();
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('Worker Telemetry Decomposed Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ContainerMetricsCard Presenter', () => {
    it('renders container health status, CPU, RAM and specs correctly', () => {
      render(
        <ContainerMetricsCard
          containerData={{
            container_name: 'worker-prod-1',
            is_healthy: true,
            version: 'v1.4.0',
            uptime_seconds: 3600,
            host_ip: '10.0.0.1',
            jobs_24h: 120,
            avg_duration_ms: 1500,
            total_cost_24h: 3.45,
            cpu_usage: 35,
            ram_usage: 62,
          }}
        />
      );

      expect(screen.getByText('worker-prod-1')).toBeInTheDocument();
      expect(screen.getByText('Healthy')).toBeInTheDocument();
      expect(screen.getByText('v1.4.0')).toBeInTheDocument();
      expect(screen.getByText('IP: 10.0.0.1')).toBeInTheDocument();
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('62%')).toBeInTheDocument();
    });
  });

  describe('QueueMonitorGrid Presenter', () => {
    it('renders queue details and pending messages correctly in inline view', () => {
      render(
        <QueueMonitorGrid
          queues={mockWorkerData.queues}
          selectedQueue="invoice_jobs"
          showAllQueues={false}
          dismissedQueues={new Set()}
          onCloseAll={vi.fn()}
          onCloseSelected={vi.fn()}
        />
      );

      expect(screen.getByText('test_invoice.pdf')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('3 várakozó')).toBeInTheDocument();
    });
  });

  describe('PipelineStatusList Presenter', () => {
    it('renders pipeline statistics with duration and cost', () => {
      render(
        <PipelineStatusList
          pipelines={mockWorkerData.pipelines}
          periodLabel="24 óra"
        />
      );

      expect(screen.getByText('Pipeline teljesítmény (24 óra)')).toBeInTheDocument();
      expect(screen.getByText('invoice')).toBeInTheDocument();
      expect(screen.getByText('$2.15')).toBeInTheDocument();
    });
  });

  describe('WorkerPanel Orchestrator', () => {
    it('renders KPI summary cards and switches between subpanels seamlessly', async () => {
      vi.mocked(fetchManagementData).mockResolvedValue(mockWorkerData);

      renderWithProviders(<WorkerPanel />);

      const containerNodes = await screen.findAllByText('worker-prod-1');
      expect(containerNodes.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Queue várakozó')).toBeInTheDocument();
      expect(screen.getByText('Feldolgozás alatt')).toBeInTheDocument();
      expect(screen.getAllByText('Konténerek').length).toBeGreaterThanOrEqual(1);

      // Click on Worker hibák KPI card to open error subview
      const errorCard = screen.getByText(/Worker hibák/);
      fireEvent.click(errorCard);

      expect(await screen.findByText(/Hibás feldolgozások/)).toBeInTheDocument();
      expect(screen.getByText('corrupted_file.pdf')).toBeInTheDocument();
      expect(screen.getByText('Beta Ltd')).toBeInTheDocument();
    });
  });
});
