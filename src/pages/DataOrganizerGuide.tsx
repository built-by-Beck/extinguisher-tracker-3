/**
 * DataOrganizerGuide — explains how the Data Organizer works, what fields it
 * checks, and provides a downloadable example CSV so users can format their
 * data with matching column names before importing.
 *
 * Route: /dashboard/data-organizer-guide
 * Author: built_by_Beck
 */

import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Info,
  FileSpreadsheet,
  Table2,
} from 'lucide-react';

const CHECKED_FIELDS = [
  {
    name: 'parentLocation',
    label: 'Location / Building',
    why: 'Without a location, the extinguisher won\'t show up in workspace drill-downs or location reports.',
    example: 'Building A, Main Hospital, Warehouse B',
  },
  {
    name: 'serial',
    label: 'Serial Number',
    why: 'Serial numbers are needed for lifecycle tracking, 6-year maintenance, and hydrostatic test scheduling.',
    example: 'SN-12345, K-2024-0987',
  },
  {
    name: 'extinguisherType',
    label: 'Extinguisher Type',
    why: 'The type determines which NFPA 10 inspection and maintenance rules apply.',
    example: 'ABC Dry Chemical, CO2, Water, Clean Agent',
  },
  {
    name: 'manufactureYear',
    label: 'Manufacture Year',
    why: 'Required to calculate 6-year maintenance and 12-year hydrostatic test due dates.',
    example: '2019, 2021, 2023',
  },
  {
    name: 'extinguisherSize',
    label: 'Size / Weight',
    why: 'Useful for compliance reports and verifying the right extinguisher is in each location.',
    example: '5 lbs, 10 lbs, 20 lbs',
  },
];

const EXAMPLE_ROWS = [
  { assetId: 'EX-001', serial: 'SN-12345', parentLocation: 'Building A', extinguisherType: 'ABC Dry Chemical', manufactureYear: '2021', extinguisherSize: '10 lbs', status: 'complete' },
  { assetId: 'EX-003', serial: '', parentLocation: 'Warehouse B', extinguisherType: 'ABC Dry Chemical', manufactureYear: '2019', extinguisherSize: '20 lbs', status: 'missing serial' },
  { assetId: 'EX-004', serial: 'SN-22222', parentLocation: '', extinguisherType: '', manufactureYear: '2022', extinguisherSize: '', status: 'missing location, type, size' },
  { assetId: 'EX-005', serial: 'SN-33333', parentLocation: 'Building C', extinguisherType: '', manufactureYear: '', extinguisherSize: '5 lbs', status: 'missing type, year' },
];

export default function DataOrganizerGuide() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Back link */}
      <Link
        to="/dashboard/data-organizer"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-red-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Data Organizer
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Wrench className="h-8 w-8 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Data Organizer Guide</h1>
        </div>
        <p className="mt-2 text-gray-600">
          The Data Organizer helps you fix incomplete extinguisher records after an import.
          This guide explains what it checks, why each field matters, and how to format your
          data so everything lines up on the first try.
        </p>
      </div>

      {/* What the Data Organizer does */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Info className="h-5 w-5 text-orange-600" />
          What Does the Data Organizer Do?
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          When you import extinguishers from a spreadsheet, some records may be missing key details
          like a location, serial number, type, or manufacture year. The Data Organizer scans your
          inventory and flags every extinguisher that has one or more missing fields. From there you can:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            <span><strong>Edit one at a time</strong> — click on any row and fill in the missing fields inline.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            <span><strong>Bulk-assign locations</strong> — select multiple extinguishers and assign them all to the same building and section at once.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            <span><strong>Filter by issue type</strong> — use the dropdown to show only extinguishers missing a specific field (e.g. "No serial" or "No type").</span>
          </li>
        </ul>
      </div>

      {/* Fields it checks */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Table2 className="h-5 w-5 text-orange-600" />
          Fields the Data Organizer Checks
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          If any of these fields are empty, the extinguisher will appear in the Data Organizer.
          Fill them in to get it off the list.
        </p>
        <div className="mt-4 space-y-3">
          {CHECKED_FIELDS.map((f) => (
            <div key={f.name} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-2">
                <code className="rounded bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                  {f.name}
                </code>
                <span className="text-sm font-semibold text-gray-900">{f.label}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{f.why}</p>
              <p className="mt-1 font-mono text-xs text-gray-400">e.g. {f.example}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Download example */}
      <div className="mb-8 rounded-xl border-2 border-dashed border-orange-200 bg-orange-50 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Download className="h-5 w-5 text-orange-600" />
          Download the Example File
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          This example CSV uses the exact column names the system expects. Open it in Excel or
          Google Sheets, replace the sample rows with your own data, and import it from the
          Inventory page. Records with complete data will pass right through; records with
          missing fields will show up in the Data Organizer for you to fix.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <a
            href="/data-organizer-example.csv"
            download="data-organizer-example.csv"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-700"
          >
            <Download className="h-4 w-4" />
            Download Example CSV
          </a>
          <a
            href="/extinguisher-import-template-full.csv"
            download="extinguisher-import-template-full.csv"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Full Import Template (all columns)
          </a>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          The example file includes 5 rows — some complete, some with missing fields on purpose
          so you can see exactly what triggers the Data Organizer.
        </p>
      </div>

      {/* Example preview */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <FileSpreadsheet className="h-5 w-5 text-orange-600" />
          What the Example Looks Like
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Here is a preview of the example file. Notice that rows 3, 4, and 5 have blank cells —
          those extinguishers would appear in the Data Organizer after import.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-gray-900">assetId</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-gray-900">serial</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-gray-900">parentLocation</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-gray-900">extinguisherType</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-gray-900">manufactureYear</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-gray-900">extinguisherSize</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-gray-900">Issues?</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {EXAMPLE_ROWS.map((row) => (
                <tr key={row.assetId} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{row.assetId}</td>
                  <td className={`whitespace-nowrap px-3 py-2 font-mono text-xs ${!row.serial ? 'bg-red-50 text-red-400 italic' : ''}`}>
                    {row.serial || '(empty)'}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 font-mono text-xs ${!row.parentLocation ? 'bg-red-50 text-red-400 italic' : ''}`}>
                    {row.parentLocation || '(empty)'}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 font-mono text-xs ${!row.extinguisherType ? 'bg-red-50 text-red-400 italic' : ''}`}>
                    {row.extinguisherType || '(empty)'}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 font-mono text-xs ${!row.manufactureYear ? 'bg-red-50 text-red-400 italic' : ''}`}>
                    {row.manufactureYear || '(empty)'}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 font-mono text-xs ${!row.extinguisherSize ? 'bg-red-50 text-red-400 italic' : ''}`}>
                    {row.extinguisherSize || '(empty)'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {row.status === 'complete' ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> {row.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column names tip */}
      <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Info className="h-5 w-5 text-blue-600" />
          Column Names Don&apos;t Have to Be Exact
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          The import system recognizes many common variations. For example, <strong>&quot;Serial Number&quot;</strong>,
          {' '}<strong>&quot;SN&quot;</strong>, or <strong>&quot;serial&quot;</strong> all map to the same field. If a column
          can&apos;t be matched automatically, a Column Mapper will pop up and let you match it yourself.
          But using the exact column names from the example file is the fastest way to skip that step entirely.
        </p>
      </div>

      {/* Workflow steps */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Wrench className="h-5 w-5 text-orange-600" />
          Recommended Workflow
        </h2>
        <ol className="mt-4 space-y-4 text-sm text-gray-700">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">1</span>
            <span>
              <strong>Download the example</strong> above and use it as a starting point.
              Replace the sample rows with your real data, keeping the header row as-is.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">2</span>
            <span>
              <strong>Fill in what you know.</strong> If you don&apos;t have a serial number or manufacture year for
              every extinguisher, that&apos;s fine — leave the cell blank and import anyway.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">3</span>
            <span>
              <strong>Import from Inventory.</strong> Go to{' '}
              <Link to="/dashboard/inventory" className="font-medium text-red-600 hover:text-red-500">Inventory</Link>,
              select a default location, and upload your file.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">4</span>
            <span>
              <strong>Open the Data Organizer.</strong> Go to{' '}
              <Link to="/dashboard/data-organizer" className="font-medium text-red-600 hover:text-red-500">Data Organizer</Link>{' '}
              to see which extinguishers have gaps. Fix them one by one or use bulk-assign for locations.
            </span>
          </li>
        </ol>
      </div>

      {/* CTA */}
      <div className="rounded-xl bg-gray-900 px-6 py-8 text-center">
        <h2 className="text-xl font-bold text-white">Ready to clean up your data?</h2>
        <p className="mt-2 text-sm text-gray-300">
          Head to the Data Organizer to see which extinguishers need attention.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/dashboard/data-organizer"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-700"
          >
            Open Data Organizer
          </Link>
          <a
            href="/data-organizer-example.csv"
            download="data-organizer-example.csv"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <Download className="h-4 w-4" />
            Download Example
          </a>
        </div>
      </div>
    </div>
  );
}
