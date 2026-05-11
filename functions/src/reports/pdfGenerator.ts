/**
 * PDF report generator for ExtinguisherTracker compliance inspection reports.
 * Uses pdfmake v0.3.x to produce a formatted PDF with header, summary stats, and results table.
 *
 * Author: built_by_Beck
 */

import PdfMake from 'pdfmake';
import type { DocumentDefinition, ContentText } from 'pdfmake';
import path from 'path';
import { createRequire } from 'module';

// Resolve pdfmake package path without import.meta (compatible with CJS output)
const _require = createRequire(process.cwd() + '/package.json');
const pdfmakeDir = path.dirname(_require.resolve('pdfmake/package.json'));
const FONTS_PATH = path.join(pdfmakeDir, 'fonts', 'Roboto');

export interface ReportResultRow {
  assetId: string;
  serial: string;
  parentLocation: string;
  locationName: string;
  section: string;
  vicinity: string;
  status: string;
  inspectedAt: string;
  inspectedBy: string;
  notes: string;
  checklistData: Record<string, string> | null;
}

export interface ReportPDFData {
  orgName: string;
  label: string;
  monthYear: string;
  generatedAt: Date;
  criteria?: {
    scope: string;
    sortBy: string;
  };
  stats: {
    total: number;
    passed: number;
    failed: number;
    pending: number;
  };
  results: ReportResultRow[];
}

/**
 * Generates a compliance inspection report PDF.
 * Returns the PDF as a Buffer.
 */
export async function generateInspectionReportPDF(
  data: ReportPDFData,
): Promise<Buffer> {
  PdfMake.addFonts({
    Roboto: {
      normal: path.join(FONTS_PATH, 'Roboto-Regular.ttf'),
      bold: path.join(FONTS_PATH, 'Roboto-Medium.ttf'),
      italics: path.join(FONTS_PATH, 'Roboto-Italic.ttf'),
      bolditalics: path.join(FONTS_PATH, 'Roboto-MediumItalic.ttf'),
    },
  });

  const passRate =
    data.stats.total > 0
      ? Math.round((data.stats.passed / data.stats.total) * 100)
      : 0;

  const formattedDate = data.generatedAt.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const displayLocation = (row: ReportResultRow) =>
    row.parentLocation || row.locationName || '--';
  const criteriaText = data.criteria
    ? `Scope: ${data.criteria.scope.replace(/_/g, ' ')} | Sorted by: ${data.criteria.sortBy}`
    : null;

  // Table rows: header row + data rows
  const tableHeaderRow: ContentText[] = [
    {
      text: 'Asset Number',
      bold: true,
      fillColor: '#C0392B',
      color: '#FFFFFF',
      fontSize: 8,
      margin: [3, 4, 3, 4],
    },
    {
      text: 'Serial Number',
      bold: true,
      fillColor: '#C0392B',
      color: '#FFFFFF',
      fontSize: 8,
      margin: [3, 4, 3, 4],
    },
    {
      text: 'Location',
      bold: true,
      fillColor: '#C0392B',
      color: '#FFFFFF',
      fontSize: 8,
      margin: [3, 4, 3, 4],
    },
    {
      text: 'Section',
      bold: true,
      fillColor: '#C0392B',
      color: '#FFFFFF',
      fontSize: 8,
      margin: [3, 4, 3, 4],
    },
    {
      text: 'Vicinity',
      bold: true,
      fillColor: '#C0392B',
      color: '#FFFFFF',
      fontSize: 8,
      margin: [3, 4, 3, 4],
    },
    {
      text: 'Status',
      bold: true,
      fillColor: '#C0392B',
      color: '#FFFFFF',
      fontSize: 8,
      margin: [3, 4, 3, 4],
    },
    {
      text: 'Inspected At',
      bold: true,
      fillColor: '#C0392B',
      color: '#FFFFFF',
      fontSize: 8,
      margin: [3, 4, 3, 4],
    },
    {
      text: 'Inspected By',
      bold: true,
      fillColor: '#C0392B',
      color: '#FFFFFF',
      fontSize: 8,
      margin: [3, 4, 3, 4],
    },
    {
      text: 'Notes',
      bold: true,
      fillColor: '#C0392B',
      color: '#FFFFFF',
      fontSize: 8,
      margin: [3, 4, 3, 4],
    },
  ];

  const tableDataRows: ContentText[][] = data.results.map((r) => [
    { text: r.assetId || '--', fontSize: 8, margin: [3, 3, 3, 3] },
    { text: r.serial || '--', fontSize: 8, margin: [3, 3, 3, 3] },
    { text: displayLocation(r), fontSize: 8, margin: [3, 3, 3, 3] },
    { text: r.section || '--', fontSize: 8, margin: [3, 3, 3, 3] },
    { text: r.vicinity || '--', fontSize: 8, margin: [3, 3, 3, 3] },
    { text: r.status || '--', fontSize: 8, margin: [3, 3, 3, 3] },
    { text: r.inspectedAt || '--', fontSize: 8, margin: [3, 3, 3, 3] },
    { text: r.inspectedBy || '--', fontSize: 8, margin: [3, 3, 3, 3] },
    {
      text: r.notes
        ? r.notes.length > 60
          ? r.notes.slice(0, 57) + '...'
          : r.notes
        : '--',
      fontSize: 8,
      margin: [3, 3, 3, 3],
    },
  ]);

  const docDefinition: DocumentDefinition = {
    pageOrientation: 'landscape',
    pageMargins: [40, 60, 40, 60],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    styles: {
      reportTitle: {
        fontSize: 20,
        bold: true,
        color: '#C0392B',
        margin: [0, 0, 0, 4],
      },
      subheader: {
        fontSize: 13,
        bold: true,
        color: '#2C3E50',
        margin: [0, 0, 0, 2],
      },
      sectionTitle: {
        fontSize: 12,
        bold: true,
        color: '#2C3E50',
        margin: [0, 16, 0, 6],
      },
      statLabel: { fontSize: 10, color: '#7F8C8D' },
      footerText: { fontSize: 8, color: '#95A5A6', italics: true },
    },
    content: [
      // Title
      {
        text: 'ExtinguisherTracker Compliance Report',
        style: 'reportTitle',
      } as ContentText,
      { text: data.orgName, style: 'subheader' } as ContentText,
      {
        text: `Workspace: ${data.label} (${data.monthYear})`,
        fontSize: 11,
        color: '#555555',
        margin: [0, 0, 0, 2] as [number, number, number, number],
      } as ContentText,
      {
        text: `Generated: ${formattedDate}`,
        fontSize: 9,
        color: '#7F8C8D',
        margin: [0, 0, 0, criteriaText ? 4 : 16] as [
          number,
          number,
          number,
          number,
        ],
      } as ContentText,
      ...(criteriaText
        ? [
            {
              text: criteriaText,
              fontSize: 9,
              color: '#7F8C8D',
              margin: [0, 0, 0, 16] as [number, number, number, number],
            } as ContentText,
          ]
        : []),

      // Summary section title
      { text: 'Inspection Summary', style: 'sectionTitle' } as ContentText,

      // Stats row
      {
        columns: [
          {
            stack: [
              { text: 'Total', style: 'statLabel' } as ContentText,
              {
                text: String(data.stats.total),
                fontSize: 16,
                bold: true,
                color: '#2C3E50',
              } as ContentText,
            ],
          },
          {
            stack: [
              { text: 'Passed', style: 'statLabel' } as ContentText,
              {
                text: String(data.stats.passed),
                fontSize: 16,
                bold: true,
                color: '#27AE60',
              } as ContentText,
            ],
          },
          {
            stack: [
              { text: 'Failed', style: 'statLabel' } as ContentText,
              {
                text: String(data.stats.failed),
                fontSize: 16,
                bold: true,
                color: '#E74C3C',
              } as ContentText,
            ],
          },
          {
            stack: [
              { text: 'Pending', style: 'statLabel' } as ContentText,
              {
                text: String(data.stats.pending),
                fontSize: 16,
                bold: true,
                color: '#7F8C8D',
              } as ContentText,
            ],
          },
          {
            stack: [
              { text: 'Pass Rate', style: 'statLabel' } as ContentText,
              {
                text: `${passRate}%`,
                fontSize: 16,
                bold: true,
                color: passRate >= 80 ? '#27AE60' : '#E74C3C',
              } as ContentText,
            ],
          },
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },

      // Results table title
      { text: 'Inspection Results', style: 'sectionTitle' } as ContentText,

      // Results table or empty message
      ...(data.results.length > 0
        ? [
            {
              table: {
                headerRows: 1,
                widths: [
                  'auto',
                  'auto',
                  '*',
                  '*',
                  '*',
                  'auto',
                  'auto',
                  '*',
                  '*',
                ] as (string | number)[],
                body: [tableHeaderRow, ...tableDataRows],
              },
              layout: 'lightHorizontalLines',
              margin: [0, 0, 0, 16] as [number, number, number, number],
            },
          ]
        : [
            {
              text: 'No inspection records found for this workspace.',
              italics: true,
              color: '#7F8C8D',
              margin: [0, 0, 0, 16] as [number, number, number, number],
            } as ContentText,
          ]),
    ],
    footer: (currentPage: number, pageCount: number): ContentText => {
      void currentPage;
      void pageCount;
      return {
        text: 'Generated by ExtinguisherTracker — NFPA 10 Compliance Platform',
        style: 'footerText',
        alignment: 'center',
        margin: [40, 10, 40, 0] as [number, number, number, number],
      };
    },
  };

  const pdfDoc = PdfMake.createPdf(docDefinition);
  return pdfDoc.getBuffer();
}
