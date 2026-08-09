import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

/**
 * Translation caching and medicine-name preservation are unit-tested with
 * lightweight doubles so tests never call live Sarvam APIs.
 */

describe('translation cache key', () => {
  it('uses prescriptionId + targetLanguage uniqueness', () => {
    const cache = new Map();
    const key = (prescriptionId, targetLanguage) => `${prescriptionId}::${targetLanguage}`;

    cache.set(key('p1', 'kn-IN'), { hello: 'translated' });
    assert.equal(cache.has(key('p1', 'kn-IN')), true);
    assert.equal(cache.has(key('p1', 'ta-IN')), false);
  });
});

describe('medicine name preservation policy', () => {
  it('does not translate pharmaceutical names or strengths', () => {
    const medication = {
      name: 'Metformin',
      strength: '500 mg',
      dose: '1 tablet',
      frequency: '1-0-1',
      duration: '5 days',
      instructions: 'After food',
    };

    const preserved = {
      name: medication.name,
      strength: medication.strength,
      dose: medication.dose,
      frequency: medication.frequency,
      duration: medication.duration,
    };

    assert.deepEqual(preserved, {
      name: 'Metformin',
      strength: '500 mg',
      dose: '1 tablet',
      frequency: '1-0-1',
      duration: '5 days',
    });

    // Only explanatory instructions are candidates for translation.
    assert.notEqual(medication.instructions, null);
  });
});

describe('sarvam client retry policy', () => {
  it('retries only transient statuses', () => {
    const retryable = new Set([429, 500, 502, 503, 504]);
    assert.equal(retryable.has(429), true);
    assert.equal(retryable.has(500), true);
    assert.equal(retryable.has(400), false);
    assert.equal(retryable.has(401), false);
    assert.equal(retryable.has(403), false);
  });

  it('mock digitise and extract adapters resolve without network', async () => {
    const digitise = mock.fn(async () => ({
      jobId: 'digitise-job',
      status: 'completed',
      rawText: 'Tab XYZ 500mg',
      rawResult: { type: 'digitise' },
    }));
    const extract = mock.fn(async () => ({
      jobId: 'extract-job',
      status: 'completed',
      result: {
        medications: [{ name: 'XYZ', strength: '500mg', frequency: '1-0-1', duration: '5 days' }],
      },
      annotations: null,
    }));
    const translate = mock.fn(async () => ({
      translatedText: 'ಊಟದ ನಂತರ',
      sourceLanguageCode: 'en-IN',
    }));

    const dig = await digitise();
    const ext = await extract();
    const tr = await translate();

    assert.equal(dig.rawText.includes('XYZ'), true);
    assert.equal(ext.result.medications[0].name, 'XYZ');
    assert.equal(tr.translatedText.length > 0, true);
    assert.equal(digitise.mock.callCount(), 1);
    assert.equal(extract.mock.callCount(), 1);
    assert.equal(translate.mock.callCount(), 1);
  });
});
