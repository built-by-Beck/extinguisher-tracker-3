/**
 * ImportGuide — step-by-step instructions for importing extinguishers via CSV.
 * Includes a downloadable template and column reference table.
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

const COLUMNS = [
  { name: 'assetId', required: true, description: 'Unique ID for the extinguisher (e.g., EX-001, TAG-100). Must be unique — duplicates will be skipped.', example: 'EX-001' },
  { name: 'serial', required: false, description: 'Manufacturer serial number printed on the label or nameplate.', example: 'SN-12345' },
  { name: 'barcode', required: false, description: 'UPC, EAN, or any barcode value associated with the unit.', example: '012345678901' },
  { name: 'manufacturer', required: false, description: 'Brand or manufacturer name (Kidde, Amerex, Badger, etc.).', example: 'Kidde' },
  { name: 'extinguisherType', required: false, description: 'Type of extinguishing agent — ABC Dry Chemical, CO2, Water, Foam, Clean Agent, etc.', example: 'ABC Dry Chemical' },
  { name: 'serviceClass', required: false, description: 'Fire rating/class from the label (e.g., 2-A:10-B:C, 4-A:60-B:C).', example: '2-A:10-B:C' },
  { name: 'extinguisherSize', required: false, description: 'Weight or capacity of the unit (e.g., 5 lbs, 10 lbs, 2.5 gal).', example: '10 lbs' },
  { name: 'category', required: false, description: 'Asset status. If left blank, defaults to "standard". Options: standard, spare, replaced, retired, out_of_service.', example: 'standard' },
  { name: 'section', required: false, description: 'Zone, wing, floor, or department where the extinguisher is located.', example: 'Floor 1' },
  { name: 'vicinity', required: false, description: 'Specific placement details — where exactly is it? (e.g., "Next to elevator", "Above fire blanket").', example: 'Next to elevator' },
  { name: 'parentLocation', required: false, description: 'Building, facility, or site name. Groups extinguishers by location.', example: 'Building A' },
  { name: 'locationId', required: false, description: 'Room number or location ID if your facility uses them.', example: 'RM-101' },
  { name: 'manufactureYear', required: false, description: 'Four-digit year the extinguisher was manufactured. Used for lifecycle calculations.', example: '2021' },
  { name: 'expirationYear', required: false, description: 'Four-digit year the extinguisher expires or reaches end of life.', example: '2033' },
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
          Follow these steps to bulk-import your extinguisher inventory from a spreadsheet.
          This works with CSV files, Excel files (.xlsx/.xls), and tab-delimited text files.
        </p>
      </div>

      {/* Download template */}
      <div className="mb-8 rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Download className="h-5 w-5 text-red-600" />
          Step 1: Download the Template
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Start with our pre-formatted template. It has all the correct column headers and
          5 example rows so you can see exactly how to fill it in. Delete the example rows
          and replace them with your own data.
        </p>
        <a
          href="/extinguisher-import-template.csv"
          download="extinguisher-import-template.csv"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700"
        >
          <Download className="h-4 w-4" />
          Download CSV Template
        </a>
      </div>

      {/* Step 2: Fill in */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <FileSpreadsheet className="h-5 w-5 text-red-600" />
          Step 2: Fill In Your Data
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Open the template in Excel, Google Sheets, or any spreadsheet app. Fill in one
          row per extinguisher. Keep the header row exactly as-is.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <p className="text-sm text-gray-700">
              <strong>assetId is the only required column.</strong> Every row must have a unique
              asset ID. Rows without one will be skipped.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <p className="text-sm text-gray-700">
              All other columns are optional. Fill in what you have — you can always
              add more details later from within the app.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <p className="text-sm text-gray-700">
              <strong>Year fields</strong> should be 4-digit years (e.g., 2021, 2033) — not
              full dates.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <p className="text-sm text-gray-700">
              <strong>Category</strong> defaults to &quot;standard&quot; if left blank. Other
              options: spare, replaced, retired, out_of_service.
            </p>
          </div>
        </div>
      </div>

      {/* Step 3: Save as CSV */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Info className="h-5 w-5 text-red-600" />
          Step 3: Save Your File
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          When you are done entering your data, save the file. We accept these formats:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            <span><strong>CSV</strong> (.csv) — best compatibility, works everywhere</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            <span><strong>Excel</strong> (.xlsx or .xls) — save directly from Excel or Google Sheets</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            <span><strong>Text</strong> (.txt) — tab-delimited or pipe-delimited</span>
          </li>
        </ul>
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              If saving from Google Sheets, go to <strong>File → Download → Comma Separated Values (.csv)</strong>.
              If saving from Excel, go to <strong>File → Save As</strong> and choose <strong>CSV (Comma delimited)</strong>.
            </span>
          </p>
        </div>
      </div>

      {/* Step 4: Upload */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <CheckCircle2 className="h-5 w-5 text-red-600" />
          Step 4: Upload to Extinguisher Tracker
        </h2>
        <ol className="mt-3 space-y-3 text-sm text-gray-700">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">1</span>
            <span>Go to the <Link to="/dashboard/inventory" className="font-medium text-red-600 hover:text-red-500">Inventory</Link> page.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">2</span>
            <span>Click the <strong>Import</strong> button (or drag and drop your file onto the page).</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">3</span>
            <span>Select your CSV, Excel, or text file.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">4</span>
            <span>
              If your column names match the template, the import starts automatically. If
              they don&apos;t match exactly, a <strong>Column Mapper</strong> screen will appear — just
              match each of your columns to the correct field and click Import.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">5</span>
            <span>
              You will see a summary showing how many were imported, how many were skipped
              (duplicates), and any errors.
            </span>
          </li>
        </ol>
      </div>

      {/* Column reference table */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Column Reference</h2>
        <p className="mb-4 text-sm text-gray-600">
          Here is every column we accept, what it means, and an example value.
          Your CSV column names don&apos;t have to match exactly — the system recognizes
          common variations (e.g., &quot;Asset ID&quot;, &quot;asset_id&quot;, &quot;Tag&quot;, &quot;Unit ID&quot; all map
          to <strong>assetId</strong>).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-900">Column</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-900">Required</th>
                <th className="px-3 py-2.5 font-semibold text-gray-900">Description</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-900">Example</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((col) => (
                <tr key={col.name} className="border-b border-gray-100">
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-gray-900">
                    {col.name}
                  </td>
                  <td className="px-3 py-2.5">
                    {col.required ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Required
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Optional</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{col.description}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-gray-500">
                    {col.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tips */}
      <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Info className="h-5 w-5 text-blue-600" />
          Tips
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>You can import up to <strong>499 extinguishers at a time</strong>. For larger inventories, split your file and import in batches.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>If an asset ID already exists in your organization, that row is skipped — your existing data is never overwritten.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>Extra columns in your file are ignored, so you don&apos;t have to remove them.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>You can always edit any extinguisher after import to add more details, photos, or location assignments.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>Don&apos;t have all the data? That&apos;s fine. Import what you have now and fill in the rest later.</span>
          </li>
        </ul>
      </div>

      {/* CTA */}
      <div className="rounded-xl bg-gray-900 px-6 py-8 text-center">
        <h2 className="text-xl font-bold text-white">Ready to import?</h2>
        <p className="mt-2 text-sm text-gray-300">
          Head to the Inventory page and click Import, or drag and drop your file.
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
