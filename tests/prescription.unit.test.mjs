import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createEmptyCanonicalPrescription,
  mapExtractResultToCanonical,
  nullableString,
} from '../lib/prescriptions/prescription.mapper.js';
import {
  detectFileType,
  MAX_UPLOAD_BYTES,
  validateTargetLanguage,
} from '../lib/prescriptions/prescription.validator.js';
import { AppError } from '../lib/utils/errors.js';
import { isSupportedLanguage, resolveSourceLanguageCode } from '../lib/sarvam/languages.js';
import { extractDigitisedText } from '../lib/sarvam/document.js';
import { canTransitionStatus, PrescriptionStatus } from '../lib/prescriptions/status.js';

describe('nullableString', () => {
  it('keeps missing values as null', () => {
    assert.equal(nullableString(null), null);
    assert.equal(nullableString(undefined), null);
    assert.equal(nullableString(''), null);
    assert.equal(nullableString('-'), null);
    assert.equal(nullableString('n/a'), null);
  });

  it('trims valid strings', () => {
    assert.equal(nullableString('  Metformin  '), 'Metformin');
  });
});

describe('mapExtractResultToCanonical', () => {
  it('never invents fields when extract result is empty', () => {
    const { prescription } = mapExtractResultToCanonical(null);
    assert.deepEqual(prescription, createEmptyCanonicalPrescription());
  });

  it('maps medications and marks unclear handwriting', () => {
    const { prescription } = mapExtractResultToCanonical({
      medications: [
        {
          name: 'unclear scribble',
          strength: '500mg',
          frequency: '1-0-1',
          duration: null,
          verificationRequired: true,
        },
      ],
      vitals: {
        bloodPressure: null,
        bloodSugar: '120',
      },
      diagnosis: ['Fever'],
    });

    assert.equal(prescription.medications[0].name, 'unclear scribble');
    assert.equal(prescription.medications[0].verificationRequired, true);
    assert.equal(prescription.medications[0].duration, null);
    assert.equal(prescription.vitals.bloodPressure, null);
    assert.equal(prescription.vitals.bloodSugar, '120');
    assert.deepEqual(prescription.diagnosis, ['Fever']);
  });

  it('preserves low Sarvam confidence as verificationRequired', () => {
    const { prescription } = mapExtractResultToCanonical(
      {
        medications: [{ name: 'XYZ', strength: '500mg' }],
      },
      {
        annotations: {
          medications: [{ name: { confidence: 0.2, sources: [] } }],
        },
      },
    );

    assert.equal(prescription.medications[0].verificationRequired, true);
  });
});

describe('detectFileType', () => {
  it('detects JPEG magic bytes', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const result = detectFileType(buffer, 'rx.jpg', 'image/jpeg');
    assert.equal(result?.mimeType, 'image/jpeg');
  });

  it('detects PNG magic bytes', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = detectFileType(buffer, 'rx.png', 'image/png');
    assert.equal(result?.mimeType, 'image/png');
  });

  it('detects PDF magic bytes', () => {
    const buffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
    const result = detectFileType(buffer, 'rx.pdf', 'application/pdf');
    assert.equal(result?.mimeType, 'application/pdf');
    assert.equal(result?.corrupt, false);
  });

  it('rejects unknown binary', () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    assert.equal(detectFileType(buffer, 'rx.bin', 'application/octet-stream'), null);
  });
});

describe('validateTargetLanguage', () => {
  it('accepts supported languages', () => {
    assert.equal(validateTargetLanguage('kn-IN'), 'kn-IN');
    assert.equal(validateTargetLanguage('ta-IN'), 'ta-IN');
    assert.equal(validateTargetLanguage('te-IN'), 'te-IN');
  });

  it('rejects unsupported languages', () => {
    assert.throws(() => validateTargetLanguage('fr-FR'), (error) => error instanceof AppError);
  });

  it('allows omitted language', () => {
    assert.equal(validateTargetLanguage(null), null);
    assert.equal(validateTargetLanguage(undefined), null);
  });
});

describe('languages', () => {
  it('includes required Indian languages', () => {
    for (const code of ['en-IN', 'hi-IN', 'kn-IN', 'ta-IN', 'te-IN', 'ml-IN']) {
      assert.equal(isSupportedLanguage(code), true);
    }
  });

  it('resolves free-form extract languages to Sarvam codes or auto', () => {
    assert.equal(resolveSourceLanguageCode('en-IN'), 'en-IN');
    assert.equal(resolveSourceLanguageCode('English'), 'en-IN');
    assert.equal(resolveSourceLanguageCode('hi'), 'hi-IN');
    assert.equal(resolveSourceLanguageCode('Kannada'), 'kn-IN');
    assert.equal(resolveSourceLanguageCode('unknown-script'), 'auto');
    assert.equal(resolveSourceLanguageCode(null), 'auto');
    assert.equal(resolveSourceLanguageCode(''), 'auto');
  });
});

describe('extractDigitisedText', () => {
  it('joins page content without inventing text', () => {
    const text = extractDigitisedText({
      documents: [
        {
          pages: [
            { page_number: 1, content: 'Tab XYZ 500mg' },
            { page_number: 2, content: '1-0-1 for 5 days' },
          ],
        },
      ],
    });
    assert.equal(text, 'Tab XYZ 500mg\n\n1-0-1 for 5 days');
  });

  it('returns empty string for missing documents', () => {
    assert.equal(extractDigitisedText({}), '');
  });
});

describe('status transitions', () => {
  it('allows the happy path', () => {
    assert.equal(canTransitionStatus(PrescriptionStatus.CREATED, PrescriptionStatus.UPLOADING), true);
    assert.equal(canTransitionStatus(PrescriptionStatus.UPLOADING, PrescriptionStatus.DIGITISING), true);
    assert.equal(canTransitionStatus(PrescriptionStatus.DIGITISING, PrescriptionStatus.EXTRACTING), true);
    assert.equal(canTransitionStatus(PrescriptionStatus.EXTRACTING, PrescriptionStatus.COMPLETED), true);
  });

  it('blocks invalid jumps', () => {
    assert.equal(canTransitionStatus(PrescriptionStatus.CREATED, PrescriptionStatus.COMPLETED), false);
    assert.equal(canTransitionStatus(PrescriptionStatus.COMPLETED, PrescriptionStatus.DIGITISING), false);
  });
});

describe('upload limits', () => {
  it('caps uploads at 50MB', () => {
    assert.equal(MAX_UPLOAD_BYTES, 50 * 1024 * 1024);
  });
});
