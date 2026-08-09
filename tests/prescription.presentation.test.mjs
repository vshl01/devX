import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyTranslations,
  buildPrescriptionPresentation,
  buildStructuredPresentation,
  collectTranslatableStrings,
  createPresentationTranslation,
  isPresentationTranslation,
} from '../lib/prescriptions/presentation.js';
import { createEmptyCanonicalPrescription } from '../lib/prescriptions/prescription.mapper.js';

describe('buildStructuredPresentation', () => {
  it('mirrors Original UI sections for present fields only', () => {
    const rx = createEmptyCanonicalPrescription();
    rx.patient.name = 'Mr. Sachin Sansare';
    rx.patient.age = '28';
    rx.patient.gender = 'm';
    rx.date = '12/10/22';
    rx.medications = [
      {
        name: 'Augmentin',
        strength: '625mg',
        form: 'Tab.',
        dose: '1 - 0 - 1',
        frequency: null,
        timing: 'after meals',
        duration: 'x 5 days',
        instructions: null,
      },
    ];

    const structured = buildStructuredPresentation(rx);
    assert.ok(structured);
    assert.equal(structured.version, 4);
    assert.equal(structured.sections[0].title, 'Patient');
    assert.equal(structured.sections[0].fields[0].label, 'Name');
    assert.equal(structured.sections[0].fields[0].translateValue, false);

    const meds = structured.sections.find((s) => s.id === 'medications');
    assert.ok(meds);
    assert.equal(meds.type, 'cards');
    assert.equal(meds.cards[0].title, 'Augmentin 625mg');
    assert.equal(meds.cards[0].translateTitle, false);

    const timing = meds.cards[0].fields.find((f) => f.key === 'timing');
    assert.equal(timing.label, 'Timing');
    assert.equal(timing.translateValue, true);

    const dose = meds.cards[0].fields.find((f) => f.key === 'dose');
    assert.equal(dose.translateValue, false);
  });

  it('omits missing sections', () => {
    const rx = createEmptyCanonicalPrescription();
    rx.patient.name = 'Ravi';
    const structured = buildStructuredPresentation(rx);
    assert.ok(structured);
    assert.equal(structured.sections.length, 1);
    assert.equal(structured.sections[0].id, 'patient');
  });
});

describe('collect + apply translations', () => {
  it('translates labels and phrase values while preserving identity values', () => {
    const rx = createEmptyCanonicalPrescription();
    rx.patient.name = 'Ravi';
    rx.medications = [
      {
        name: 'Metformin',
        strength: '500 mg',
        form: null,
        dose: '1-0-1',
        frequency: null,
        timing: 'after breakfast',
        duration: '5 days',
        instructions: null,
      },
    ];
    const structured = buildStructuredPresentation(rx);
    const { labels, values } = collectTranslatableStrings(structured);

    assert.ok(labels.includes('Patient'));
    assert.ok(labels.includes('Name'));
    assert.ok(labels.includes('Medicines'));
    assert.ok(labels.includes('Timing'));
    assert.ok(values.includes('after breakfast'));
    assert.ok(values.includes('5 days'));
    assert.ok(!values.includes('Ravi'));
    assert.ok(!values.includes('1-0-1'));

    const labelMap = new Map([
      ['Patient', 'रोगी'],
      ['Name', 'नाम'],
      ['Medicines', 'दवाइयाँ'],
      ['Medicine', 'दवा'],
      ['Dosage', 'खुराक'],
      ['Duration', 'अवधि'],
      ['Timing', 'समय'],
    ]);
    const valueMap = new Map([
      ['after breakfast', 'नाश्ते के बाद'],
      ['5 days', '5 दिन'],
    ]);

    const translated = applyTranslations(structured, labelMap, valueMap);
    assert.equal(translated.sections[0].title, 'रोगी');
    assert.equal(translated.sections[0].fields[0].label, 'नाम');
    assert.equal(translated.sections[0].fields[0].value, 'Ravi');

    const med = translated.sections.find((s) => s.id === 'medications').cards[0];
    assert.equal(med.title, 'Metformin 500 mg');
    assert.equal(med.fields.find((f) => f.key === 'timing').value, 'नाश्ते के बाद');
    assert.equal(med.fields.find((f) => f.key === 'dose').value, '1-0-1');
  });
});

describe('presentation translation shape', () => {
  it('accepts v4 structured presentations only', () => {
    const good = createPresentationTranslation(
      [{ id: 'patient', type: 'fields', title: 'ರೋಗಿ', fields: [] }],
      'kn-IN',
    );
    assert.equal(isPresentationTranslation(good), true);

    assert.equal(
      isPresentationTranslation({
        kind: 'presentation',
        version: 3,
        sections: [{ id: 'patient', type: 'fields', title: 'Patient', fields: [] }],
      }),
      false,
    );
  });
});

describe('buildPrescriptionPresentation (legacy text)', () => {
  it('still builds readable English source text', () => {
    const rx = createEmptyCanonicalPrescription();
    rx.patient.name = 'Ravi';
    rx.vitals.bloodPressure = '120/80';
    const doc = buildPrescriptionPresentation(rx);
    assert.match(doc, /Patient/);
    assert.match(doc, /Name: Ravi/);
    assert.match(doc, /Blood Pressure: 120\/80/);
  });
});
