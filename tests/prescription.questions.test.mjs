import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { answerFromPrescription } from '../lib/prescriptions/prescription.questions.js';
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
    rx.medications = [{ name: 'Metformin', strength: '500 mg', dose: '1-0-1', duration: '5 days', timing: 'After food', form: null, frequency: null, instructions: null }];
    const result = answerFromPrescription(rx, 'What medicines were prescribed?');
    assert.equal(result.found, true);
    assert.match(result.answer, /Metformin/);
  });
});
