import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getSarvamClient } from './client.js';
import { waitForJob, getJobResults } from './document.js';

/**
 * Canonical prescription extraction schema for Sarvam Extract.
 * Every field includes type + description as required by DocAI.
 */
export const PRESCRIPTION_EXTRACTION_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    patient: {
      type: 'object',
      description: 'Patient demographic details written on the prescription. Use null when absent.',
      properties: {
        name: { type: 'string', description: 'Patient full name if present; otherwise null.' },
        age: { type: 'string', description: 'Patient age exactly as written; otherwise null.' },
        gender: { type: 'string', description: 'Patient gender if present; otherwise null.' },
      },
    },
    doctor: {
      type: 'object',
      description: 'Doctor and clinic details if present on the prescription.',
      properties: {
        name: { type: 'string', description: 'Doctor name if present; otherwise null.' },
        registrationNumber: {
          type: 'string',
          description: 'Doctor registration or license number if present; otherwise null.',
        },
        clinic: { type: 'string', description: 'Clinic or hospital name if present; otherwise null.' },
      },
    },
    date: {
      type: 'string',
      description: 'Prescription date exactly as written; otherwise null.',
    },
    vitals: {
      type: 'object',
      description: 'Vital signs recorded on the prescription. Never invent values.',
      properties: {
        bloodPressure: { type: 'string', description: 'Blood pressure if present; otherwise null.' },
        bloodSugar: { type: 'string', description: 'Blood sugar if present; otherwise null.' },
        temperature: { type: 'string', description: 'Temperature if present; otherwise null.' },
        pulse: { type: 'string', description: 'Pulse if present; otherwise null.' },
        weight: { type: 'string', description: 'Weight if present; otherwise null.' },
        spo2: { type: 'string', description: 'SpO2 if present; otherwise null.' },
      },
    },
    diagnosis: {
      type: 'array',
      description: 'List of diagnoses or complaints written on the prescription. Empty if none.',
      items: {
        type: 'string',
        description: 'A single diagnosis or complaint text exactly as written.',
      },
    },
    medications: {
      type: 'array',
      description: 'Medications prescribed. Empty array if none are present.',
      items: {
        type: 'object',
        description: 'One medication entry. Do not invent missing fields.',
        properties: {
          name: { type: 'string', description: 'Medicine name; use unclear text if illegible.' },
          strength: { type: 'string', description: 'Strength such as 500mg if present; otherwise null.' },
          form: { type: 'string', description: 'Form such as tablet or syrup if present; otherwise null.' },
          dose: { type: 'string', description: 'Dose if present; otherwise null.' },
          frequency: { type: 'string', description: 'Frequency such as 1-0-1 if present; otherwise null.' },
          timing: { type: 'string', description: 'Timing such as after food if present; otherwise null.' },
          duration: { type: 'string', description: 'Duration such as 5 days if present; otherwise null.' },
          instructions: {
            type: 'string',
            description: 'Additional medicine instructions if present; otherwise null.',
          },
          verificationRequired: {
            type: 'boolean',
            description: 'True when handwriting for this medicine is unclear; otherwise false.',
          },
        },
      },
    },
    tests: {
      type: 'array',
      description: 'Investigations or lab tests ordered. Empty if none.',
      items: {
        type: 'object',
        description: 'One test entry.',
        properties: {
          name: { type: 'string', description: 'Test name if present; otherwise null.' },
          instructions: {
            type: 'string',
            description: 'Test instructions if present; otherwise null.',
          },
        },
      },
    },
    followUp: {
      type: 'object',
      description: 'Follow-up advice if present.',
      properties: {
        date: { type: 'string', description: 'Follow-up date if present; otherwise null.' },
        instructions: {
          type: 'string',
          description: 'Follow-up instructions if present; otherwise null.',
        },
      },
    },
    additionalInstructions: {
      type: 'array',
      description: 'Any other instructions not covered elsewhere. Empty if none.',
      items: {
        type: 'string',
        description: 'A single additional instruction exactly as written.',
      },
    },
    originalLanguage: {
      type: 'string',
      description: 'Detected primary language of the prescription as BCP-47 code when known; otherwise null.',
    },
  },
});

/**
 * @param {{
 *   buffer: Buffer,
 *   fileName: string,
 *   mimeType: string,
 *   language?: string,
 *   schema?: object,
 * }} input
 * @param {{ client?: import('./client.js').SarvamClient }} [options]
 */
export async function createExtractJob(input, options = {}) {
  const client = options.client ?? getSarvamClient();
  const form = new FormData();
  const file = new File([new Uint8Array(input.buffer)], input.fileName, {
    type: input.mimeType,
  });
  form.append('file', file);
  form.append('schema', JSON.stringify(input.schema || PRESCRIPTION_EXTRACTION_SCHEMA));
  form.append('language', input.language || 'en-IN');
  form.append('output_format', 'json');
  form.append('auto_orient', 'true');
  form.append('model', 'sarvam-vision-v1');

  const { data } = await client.postForm('/doc-ai/v1/job/extract', form);

  if (!data?.job_id) {
    throw new AppError(
      ErrorCodes.SARVAM_EXTRACTION_FAILED,
      'Sarvam extract job did not return a job ID.',
      502,
    );
  }

  logger.info('sarvam_extract_started', {
    operation: 'extract',
    sarvamJobId: data.job_id,
    status: data.status,
  });

  return {
    jobId: data.job_id,
    status: data.status,
    runId: data.run_id,
  };
}

/**
 * Extract structured prescription fields from a document.
 *
 * @param {{
 *   buffer: Buffer,
 *   fileName: string,
 *   mimeType: string,
 *   language?: string,
 * }} input
 * @param {{ client?: import('./client.js').SarvamClient }} [options]
 */
export async function extractPrescriptionFields(input, options = {}) {
  const started = await createExtractJob(input, options);
  const terminal = await waitForJob(started.jobId, { client: options.client });
  const terminalStatus = String(terminal?.status || '').toLowerCase();

  if (terminalStatus === 'failed' || terminalStatus === 'rejected') {
    throw new AppError(
      ErrorCodes.SARVAM_EXTRACTION_FAILED,
      'Unable to extract structured fields from the prescription.',
      502,
    );
  }

  const results = await getJobResults(started.jobId, {
    format: 'json',
    client: options.client,
  });

  return {
    jobId: started.jobId,
    status: terminalStatus,
    result: results?.result ?? null,
    annotations: results?.annotations ?? null,
    rawResult: results,
  };
}
