import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  answerFromPrescription,
  detectIntentsMultilingual,
} from '../lib/prescriptions/prescription.questions.js';
import { createEmptyCanonicalPrescription } from '../lib/prescriptions/prescription.mapper.js';

describe('answerFromPrescription', () => {
  it('answers blood pressure from structured data', () => {
    const rx = createEmptyCanonicalPrescription();
    rx.vitals.bloodPressure = '120/80';
    const result = answerFromPrescription(rx, 'What was my BP?');
    assert.equal(result.found, true);
    assert.match(result.answer, /120\/80/);
    assert.equal(result.source.field, 'vitals.bloodPressure');
  });

  it('does not invent cholesterol', () => {
    const rx = createEmptyCanonicalPrescription();
    rx.vitals.bloodPressure = '120/80';
    const result = answerFromPrescription(rx, 'What was my cholesterol?');
    assert.equal(result.found, false);
    assert.match(result.answer, /not present/i);
  });

  it('lists medicines when asked', () => {
    const rx = createEmptyCanonicalPrescription();
    rx.medications = [
      {
        name: 'Metformin',
        strength: '500 mg',
        dose: '1-0-1',
        duration: '5 days',
        timing: 'After food',
        form: null,
        frequency: null,
        instructions: null,
      },
    ];
    const result = answerFromPrescription(rx, 'What medicines were prescribed?');
    assert.equal(result.found, true);
    assert.match(result.answer, /Metformin/);
  });

  it('refuses general medical questions', () => {
    const rx = createEmptyCanonicalPrescription();
    rx.medications = [
      {
        name: 'Metformin',
        strength: '500 mg',
        dose: '1-0-1',
        duration: null,
        timing: null,
        form: null,
        frequency: null,
        instructions: null,
      },
    ];
    const result = answerFromPrescription(rx, 'What is Metformin used for?');
    assert.equal(result.found, false);
    assert.equal(result.reason, 'OUT_OF_SCOPE');
  });

  it('does not invent timing when missing', () => {
    const rx = createEmptyCanonicalPrescription();
    rx.medications = [
      {
        name: 'Metformin',
        strength: '500 mg',
        dose: '1-0-1',
        duration: '5 days',
        timing: null,
        form: null,
        frequency: null,
        instructions: null,
      },
    ];
    const result = answerFromPrescription(rx, 'When should I take Metformin before or after food?');
    assert.equal(result.found, false);
    assert.match(result.answer, /does not specify/i);
  });
});

describe('detectIntentsMultilingual', () => {
  it('maps Hindi BP phrasing to bloodPressure', () => {
    assert.ok(detectIntentsMultilingual('मेरा ब्लड प्रेशर कितना था?').includes('bloodPressure'));
  });

  it('maps Kannada BP phrasing to bloodPressure', () => {
    assert.ok(detectIntentsMultilingual('ನನ್ನ ಬಿಪಿ ಎಷ್ಟು ಇತ್ತು?').includes('bloodPressure'));
  });
});
