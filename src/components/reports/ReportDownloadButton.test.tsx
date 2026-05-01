import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateReportDownload } from '../../services/reportService.ts';
import { ReportDownloadButton } from './ReportDownloadButton.tsx';

vi.mock('../../services/reportService.ts', () => ({
  generateReportDownload: vi.fn(),
}));

const mockGenerateReportDownload = vi.mocked(generateReportDownload);

describe('ReportDownloadButton', () => {
  beforeEach(() => {
    mockGenerateReportDownload.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a stable icon slot while generating a PDF report', async () => {
    let resolveDownload!: (value: { downloadUrl: string }) => void;
    mockGenerateReportDownload.mockReturnValue(
      new Promise((resolve) => {
        resolveDownload = resolve;
      }),
    );
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<ReportDownloadButton orgId="org-1" workspaceId="april-workspace" format="pdf" />);

    const button = screen.getByRole('button', { name: 'PDF' });
    const iconCount = button.querySelectorAll('svg').length;
    expect(iconCount).toBe(2);

    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(button.querySelectorAll('svg')).toHaveLength(iconCount);
    expect(mockGenerateReportDownload).toHaveBeenCalledWith('org-1', 'april-workspace', 'pdf');

    resolveDownload({ downloadUrl: 'https://example.test/report.pdf' });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('https://example.test/report.pdf', '_blank');
    });
    expect(button).not.toBeDisabled();
    expect(button.querySelectorAll('svg')).toHaveLength(iconCount);
  });
});
