import type { Extinguisher } from '../../services/extinguisherService.ts';
import { formatDueDate } from '../../utils/compliance.ts';

interface TagLabelProps {
  extinguisher: Extinguisher;
  orgId: string;
  orgName?: string;
  qrDataUrl?: string;
  labelSize: 'small' | 'medium' | 'large';
}

const SIZE_CONFIG = {
  small: { width: 192, height: 96, qr: 72, titleText: '10px', bodyText: '7px', orgText: '6px' },
  medium: { width: 384, height: 192, qr: 144, titleText: '18px', bodyText: '12px', orgText: '10px' },
  large: { width: 576, height: 384, qr: 240, titleText: '28px', bodyText: '16px', orgText: '12px' },
} as const;

export function TagLabel({ extinguisher, orgId: _orgId, orgName, qrDataUrl, labelSize }: TagLabelProps) {
  const cfg = SIZE_CONFIG[labelSize];
  const location = extinguisher.parentLocation || extinguisher.section || '';

  return (
    <div
      className="flex border border-dashed border-gray-400 bg-white text-black overflow-hidden"
      style={{ width: `${cfg.width}px`, height: `${cfg.height}px`, pageBreakInside: 'avoid' }}
    >
      {qrDataUrl && (
        <div className="flex shrink-0 items-center justify-center p-1">
          <img
            src={qrDataUrl}
            alt="QR"
            style={{ width: `${cfg.qr}px`, height: `${cfg.qr}px` }}
          />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden px-1.5 py-1">
        <div
          className="truncate font-bold leading-tight"
          style={{ fontSize: cfg.titleText }}
        >
          {extinguisher.assetId}
        </div>
        {extinguisher.serial && (
          <div className="truncate leading-tight" style={{ fontSize: cfg.bodyText }}>
            SN: {extinguisher.serial}
          </div>
        )}
        {extinguisher.extinguisherType && (
          <div className="truncate leading-tight" style={{ fontSize: cfg.bodyText }}>
            {extinguisher.extinguisherType}
          </div>
        )}
        {location && (
          <div className="truncate leading-tight" style={{ fontSize: cfg.bodyText }}>
            {location}
          </div>
        )}
        <div className="truncate leading-tight" style={{ fontSize: cfg.bodyText }}>
          Next: {formatDueDate(extinguisher.nextMonthlyInspection)}
        </div>
        {orgName && (
          <div className="truncate leading-tight text-gray-500" style={{ fontSize: cfg.orgText }}>
            {orgName}
          </div>
        )}
      </div>
    </div>
  );
}
