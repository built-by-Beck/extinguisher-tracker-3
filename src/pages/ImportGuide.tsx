/**
 * ImportGuide — step-by-step instructions for importing extinguishers via CSV.
 * Includes downloadable templates (basic + full) and column reference.
 *
 * Author: built_by_Beck
 */

import { Link } from 'react-router-dom';
import {
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowLeft,
} from 'lucide-react';

const REQUIRED_COLUMNS = [
  { name: 'assetId', description: 'The unique ID or tag number for the extinguisher. Every row must have one — duplicates are skipped.', example: 'EX-001' },
  { name: 'serial', description: 'The serial number printed on the extinguisher label or nameplate.', example: 'SN-12345' },
  { name: 'parentLocation', description: 'The building, facility, or site the extinguisher is in. Think of this as the top-level location.', example: 'Building A' },
  { name: 'vicinity', description: 'Where exactly is it? Describe the spot so someone can walk right to it.', example: 'By the exit door on 2nd floor' },
];

const OPTIONAL_COLUMNS = [
  { name: 'section', description: 'Floor, wing, or zone — useful for large buildings with many extinguishers.', example: '2nd Floor' },
  { name: 'barcode', description: 'UPC or barcode value if you have one.', example: '012345678901' },
  { name: 'manufacturer', description: 'Brand name (Kidde, Amerex, Badger, etc.).', example: 'Kidde' },
  { name: 'extinguisherType', description: 'Type of agent — ABC Dry Chemical, CO2, Water, Foam, etc.', example: 'ABC Dry Chemical' },
  { name: 'serviceClass', description: 'Fire rating from the label.', example: '2-A:10-B:C' },
  { name: 'extinguisherSize', description: 'Weight or capacity.', example: '10 lbs' },
  { name: 'category', description: 'Defaults to "standard" if blank. Options: standard, spare, replaced, retired, out_of_service.', example: 'standard' },
  { name: 'locationId', description: 'Room number or location ID if your facility uses them.', example: 'RM-101' },
  { name: 'manufactureYear', description: 'Four-digit year manufactured.', example: '2021' },
  { name: 'expirationYear', description: 'Four-digit year it expires.', example: '2033' },
];

export default function ImportGuide() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Back link */}
      <Link
        to="/dashboard/inventory"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-red-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inventory
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-red-600" />
          <h1 className="text-2xl font-bold text-gray-900">How to Import Extinguishers</h1>
        </div>
        <p className="mt-2 text-gray-600">
          Import your extinguisher inventory from a spreadsheet in 4 easy steps.
          You only need <strong>4 columns</strong> to get started.
        </p>
      </div>

      {/* What you need */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">What you need for each extinguisher</h2>
        <p className="mt-2 text-sm text-gray-600">
          Each row in your spreadsheet is one extinguisher. You only need these 4 things:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">assetId</p>
            <p className="mt-1 text-sm text-gray-600">The unique tag or ID number</p>
            <p className="mt-1 font-mono text-xs text-gray-400">e.g. EX-001</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">serial</p>
            <p className="mt-1 text-sm text-gray-600">Serial number from the label</p>
            <p className="mt-1 font-mono text-xs text-gray-400">e.g. SN-12345</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">parentLocation</p>
            <p className="mt-1 text-sm text-gray-600">The building or facility name</p>
            <p className="mt-1 font-mono text-xs text-gray-400">e.g. Building A, Main Hospital</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">vicinity</p>
            <p className="mt-1 text-sm text-gray-600">Exactly where it is — enough detail to find it</p>
            <p className="mt-1 font-mono text-xs text-gray-400">e.g. By the exit door on 2nd floor</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          That&apos;s it. Everything else is optional — you can fill in more details later from within the app.
        </p>
      </div>

      {/* Step 1: Download */}
      <div className="mb-8 rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Download className="h-5 w-5 text-red-600" />
          Step 1: Download the Template
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Download our template, delete the example rows, and fill in your own data.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <a
            href="/extinguisher-import-template.csv"
            download="extinguisher-import-template.csv"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700"
          >
            <Download className="h-4 w-4" />
            Basic Template (4 columns)
          </a>
          <a
            href="/extinguisher-import-template-full.csv"
            download="extinguisher-import-template-full.csv"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Full Template (all columns)
          </a>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Most people should start with the basic template. The full template includes
          optional fields like manufacturer, type, size, and year.
        </p>
      </div>

      {/* Step 2: Fill in */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <FileSpreadsheet className="h-5 w-5 text-red-600" />
          Step 2: Fill In Your Data
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Open the template in Excel, Google Sheets, or any spreadsheet app.
          Fill in one row per extinguisher. Keep the header row exactly as-is.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 font-semibold text-gray-900">assetId</th>
                <th className="px-3 py-2 font-semibold text-gray-900">serial</th>
                <th className="px-3 py-2 font-semibold text-gray-900">parentLocation</th>
                <th className="px-3 py-2 font-semibold text-gray-900">vicinity</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">EX-001</td>
                <td className="px-3 py-2">SN-12345</td>
                <td className="px-3 py-2">Building A</td>
                <td className="px-3 py-2">By the exit door on 2nd floor</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">EX-002</td>
                <td className="px-3 py-2">SN-67890</td>
                <td className="px-3 py-2">Main Hospital</td>
                <td className="px-3 py-2">Lobby entrance next to front desk</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 3: Save */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Info className="h-5 w-5 text-red-600" />
          Step 3: Save Your File
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Save as one of these formats:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            <span><strong>CSV</strong> (.csv) — best compatibility</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            <span><strong>Excel</strong> (.xlsx or .xls)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            <span><strong>Text</strong> (.txt) — tab or pipe delimited</span>
          </li>
        </ul>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>Google Sheets:</strong> File → Download → Comma Separated Values (.csv).
              <strong> Excel:</strong> File → Save As → CSV (Comma delimited).
            </span>
          </p>
        </div>
      </div>

      {/* Step 4: Upload */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <CheckCircle2 className="h-5 w-5 text-red-600" />
          Step 4: Upload
        </h2>
        <ol className="mt-3 space-y-3 text-sm text-gray-700">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">1</span>
            <span>Go to <Link to="/dashboard/inventory" className="font-medium text-red-600 hover:text-red-500">Inventory</Link>.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">2</span>
            <span>Select a <strong>default location</strong> from the dropdown, then click <strong>Browse</strong> or drag and drop your file.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">3</span>
            <span>If your column names don&apos;t match exactly, a Column Mapper will appear — just match each column and click Import.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">4</span>
            <span>Done! You&apos;ll see how many were imported and if any were skipped.</span>
          </li>
        </ol>
      </div>

      {/* Large orgs tip */}
      <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Info className="h-5 w-5 text-blue-600" />
          Large Facilities?
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          If your building has multiple floors or wings, add a <strong>section</strong> column
          to your spreadsheet (e.g. &quot;1st Floor&quot;, &quot;2nd Floor&quot;, &quot;West Wing&quot;). This is included in the full template.
        </p>
      </div>

      {/* Optional columns reference */}
      <details className="mb-8 rounded-xl border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-6 py-4 text-lg font-bold text-gray-900 hover:bg-gray-50">
          All available columns (optional)
        </summary>
        <div className="border-t border-gray-200 px-6 py-4">
          <p className="mb-4 text-sm text-gray-600">
            These columns are all optional. Your file doesn&apos;t need to match exactly —
            the system recognizes common names like &quot;Asset ID&quot;, &quot;Serial Number&quot;,
            &quot;Building&quot;, &quot;Location&quot;, etc.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-900">Column</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-900">Description</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-900">Example</th>
                </tr>
              </thead>
              <tbody>
                {[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map((col) => (
                  <tr key={col.name} className="border-b border-gray-100">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-gray-900">
                      {col.name}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{col.description}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-gray-500">{col.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {/* Tips */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Info className="h-4 w-4 text-gray-500" />
          Good to know
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          <li>You can import up to <strong>499 extinguishers at a time</strong>. For larger lists, split the file and import in batches.</li>
          <li>If an asset ID already exists, that row is skipped — your existing data is never overwritten.</li>
          <li>Extra columns in your file are ignored, so you don&apos;t need to remove them.</li>
          <li>Don&apos;t have all the data? Import what you have now and use the <Link to="/dashboard/data-organizer" className="font-medium text-red-600 hover:text-red-500">Data Organizer</Link> to fill in the rest later.</li>
        </ul>
      </div>

      {/* CTA */}
      <div className="rounded-xl bg-gray-900 px-6 py-8 text-center">
        <h2 className="text-xl font-bold text-white">Ready to import?</h2>
        <p className="mt-2 text-sm text-gray-300">
          Head to Inventory and click Import, or drag and drop your file.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/dashboard/inventory"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700"
          >
            Go to Inventory
          </Link>
          <a
            href="/extinguisher-import-template.csv"
            download="extinguisher-import-template.csv"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <Download className="h-4 w-4" />
            Download Template
          </a>
        </div>
      </div>
    </div>
  );
}
