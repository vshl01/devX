# GUIDE.md

# Prescription Intelligence Backend
## Implementation Guide — Next.js + Prisma + PostgreSQL + Sarvam AI

---

# 1. ROLE

Act as a senior backend engineer.

You are working inside an ALREADY INITIALIZED Next.js project.

Your job is to inspect the existing repository and IMPLEMENT the backend for the Prescription Intelligence system.

Do NOT recreate the project.

Do NOT change the existing framework.

Do NOT migrate the project to NestJS or Express.

Do NOT build a frontend.

The existing setup is already configured.

Start by inspecting the repository and understanding what already exists.

Then plan and implement the backend incrementally.

---

# 2. PRODUCT

## Product Name

Prescription Intelligence

## Goal

A patient uploads a doctor's prescription.

The prescription may be:

- handwritten
- printed
- English
- Hindi
- Kannada
- Tamil
- Telugu
- another supported Indian language
- a mixture of languages

The system uses Sarvam AI to:

1. Digitise the prescription.
2. Extract structured information.
3. Preserve the original extracted information.
4. Translate the prescription into the patient's requested language.
5. Store the structured prescription.
6. Later allow the patient to ask questions about the prescription using text or voice.

Example:

Doctor writes:

    Tab XYZ 500mg
    1-0-1
    5 days

The system should be able to return structured information such as:

{
  "medications": [
    {
      "name": "XYZ",
      "strength": "500mg",
      "frequency": "1-0-1",
      "duration": "5 days"
    }
  ]
}

The system must NEVER invent information.

---

# 3. CORE PRINCIPLE

The prescription is the source of truth.

Sarvam AI is responsible for AI operations such as:

- document digitisation
- structured extraction
- translation
- future speech-to-text
- future natural-language question understanding
- future text-to-speech

The AI must not become an independent medical decision-maker.

This is NOT a doctor.

This is NOT a diagnosis system.

This is NOT a medical recommendation system.

This is an information extraction, translation, and retrieval system.

---

# 4. EXISTING TECH STACK

DO NOT CHANGE THIS STACK.

## Backend

Next.js

Use:

- Next.js App Router
- JavaScript
- Route Handlers
- REST APIs

Backend APIs must live under:

    app/api/

Do NOT introduce:

- NestJS
- Express
- Fastify
- separate backend server
- Python backend

Next.js itself is the backend runtime.

---

# 5. DATABASE

Database:

PostgreSQL

ORM:

Prisma

Prisma setup already exists.

Do NOT recreate Prisma setup unless something is genuinely missing.

First inspect:

    prisma/schema.prisma

and the existing Prisma configuration.

Use the existing Prisma setup.

---

# 6. AI PROVIDER

Primary AI provider:

Sarvam AI

Do NOT substitute:

- OpenAI
- Gemini
- Claude
- AWS Textract
- Google Vision
- Azure OCR
- Tesseract
- Google Translate
- other OCR providers

Sarvam should drive the core functionality.

Official documentation:

https://docs.sarvam.ai/

Before implementing any Sarvam API integration:

1. Check the current official documentation.
2. Confirm endpoint.
3. Confirm HTTP method.
4. Confirm authentication.
5. Confirm request format.
6. Confirm response format.
7. Confirm errors.
8. Implement according to the current API.

Never guess a Sarvam API contract.

---

# 7. SARVAM CAPABILITIES

The backend should be architected around the following Sarvam capabilities.

## Phase 1

### Document Intelligence / Digitise

Used for:

- handwritten prescription
- printed prescription
- scanned prescription
- document digitisation

Documentation:

https://docs.sarvam.ai/docai/how-to/digitise-a-document

API reference:

https://docs.sarvam.ai/api-reference/document-intelligence/get-upload-links

IMPORTANT:

Sarvam Document Intelligence uses a job/upload/process/retrieve style workflow.

Do not assume that uploading an image directly to a simple OCR endpoint is sufficient.

Inspect the current API documentation and implement the actual current workflow.

---

## Structured Extraction

Use Sarvam's document extraction capabilities for extracting structured fields.

Documentation:

https://docs.sarvam.ai/docai/how-to/extract-fields-from-a-document/extract-structured-fields

The output must ultimately be mapped into our application's canonical prescription schema.

---

## Translation

Use Sarvam Translation.

Documentation:

https://docs.sarvam.ai/api-reference/text/translate-text

Translation must be implemented through Sarvam.

Do not use another translation provider.

---

# 8. FUTURE SARVAM CAPABILITIES

These are intentionally prepared for but should NOT block Phase 1.

## Speech-to-text

Sarvam Saaras.

Future flow:

    Audio
      ↓
    Saaras
      ↓
    Text question

---

## Chat / Question Understanding

Sarvam Chat Completions.

Future flow:

    User question
        ↓
    Question understanding
        ↓
    Prescription data lookup
        ↓
    Grounded response

---

## Text-to-speech

Sarvam Bulbul.

Future flow:

    Grounded answer
        ↓
    Bulbul
        ↓
    Audio response

---

# 9. IMPORTANT IMPLEMENTATION STRATEGY

Do not build everything at once.

Implement in this order:

    Repository inspection
          ↓
    Sarvam client
          ↓
    Upload API
          ↓
    Document processing
          ↓
    Digitised content
          ↓
    Structured extraction
          ↓
    Canonical prescription
          ↓
    PostgreSQL persistence
          ↓
    Translation
          ↓
    Retrieval APIs
          ↓
    Testing
          ↓
    Voice/question phase

Do not start voice implementation until document processing works reliably.

---

# 10. PROJECT STRUCTURE

Use the existing project structure where possible.

If the project does not already have suitable organization, use:

    app/
      api/
        v1/
          prescriptions/
            route.js
            [id]/
              route.js
              raw/
                route.js
              translate/
                route.js
              questions/
                route.js

    lib/
      prisma.js

      sarvam/
        client.js
        document.js
        extract.js
        translate.js
        chat.js
        speech.js
        tts.js

      prescriptions/
        prescription.service.js
        prescription.mapper.js
        prescription.validator.js

      utils/
        errors.js
        response.js
        logger.js

    prisma/
      schema.prisma

Do not create files unnecessarily.

Reuse existing utilities if the repository already contains them.

---

# 11. API VERSIONING

All APIs must be under:

    /api/v1/

Example:

    POST /api/v1/prescriptions

    GET /api/v1/prescriptions/:id

Do not create unversioned production APIs.

---

# 12. MAIN API

## POST /api/v1/prescriptions

Purpose:

Upload a prescription.

Request:

Content-Type:

    multipart/form-data

Field:

    file

Optional field:

    targetLanguage

Example:

    file = prescription.jpg
    targetLanguage = kn-IN

---

# 13. UPLOAD FLOW

The request flow should be:

    Client
      ↓
    Next.js Route Handler
      ↓
    Validate file
      ↓
    Create Prescription record
      ↓
    Sarvam Document Intelligence
      ↓
    Store processing information
      ↓
    Return prescription ID

If Sarvam's document processing is asynchronous, do NOT keep the HTTP request open unnecessarily.

Return an appropriate processing response.

Example:

HTTP 202

{
  "success": true,
  "data": {
    "prescriptionId": "uuid",
    "status": "PROCESSING"
  }
}

---

# 14. PROCESSING STATUS

Possible statuses:

    CREATED
    UPLOADING
    DIGITISING
    EXTRACTING
    TRANSLATING
    COMPLETED
    PARTIALLY_COMPLETED
    FAILED

Use constants/enums.

Do not scatter raw strings throughout the code.

---

# 15. GET PRESCRIPTION

## GET /api/v1/prescriptions/:id

Return the processed prescription.

Example:

{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "COMPLETED",
    "originalLanguage": "en-IN",
    "rawText": "...",
    "prescription": {
      "patient": {},
      "doctor": {},
      "date": null,
      "vitals": {},
      "diagnosis": [],
      "medications": [],
      "tests": [],
      "followUp": {},
      "additionalInstructions": []
    }
  }
}

---

# 16. RAW DIGITISED CONTENT

## GET /api/v1/prescriptions/:id/raw

Return the original Sarvam digitised output.

Example:

{
  "success": true,
  "data": {
    "prescriptionId": "uuid",
    "rawText": "...",
    "source": "sarvam-digitise"
  }
}

The raw source must never be overwritten by translation.

---

# 17. CANONICAL PRESCRIPTION SCHEMA

The application must have one canonical internal representation.

Example:

{
  "patient": {
    "name": null,
    "age": null,
    "gender": null
  },

  "doctor": {
    "name": null,
    "registrationNumber": null,
    "clinic": null
  },

  "date": null,

  "vitals": {
    "bloodPressure": null,
    "bloodSugar": null,
    "temperature": null,
    "pulse": null,
    "weight": null,
    "spo2": null
  },

  "diagnosis": [],

  "medications": [
    {
      "name": null,
      "strength": null,
      "form": null,
      "dose": null,
      "frequency": null,
      "timing": null,
      "duration": null,
      "instructions": null
    }
  ],

  "tests": [
    {
      "name": null,
      "instructions": null
    }
  ],

  "followUp": {
    "date": null,
    "instructions": null
  },

  "additionalInstructions": []
}

This is the application's source of truth.

---

# 18. MISSING INFORMATION

Never invent missing data.

If the prescription does not contain BP:

    "bloodPressure": null

If the prescription does not contain sugar:

    "bloodSugar": null

If no diagnosis is present:

    "diagnosis": []

If no medication duration is present:

    "duration": null

Never generate plausible medical values.

---

# 19. HANDWRITING

Handwritten text is one of the primary reasons for using Sarvam Document Intelligence.

The pipeline should be:

    Prescription Image
          ↓
    Sarvam Digitise
          ↓
    Digitised Representation
          ↓
    Structured Extraction
          ↓
    Canonical Prescription

Do not add another OCR provider.

---

# 20. AMBIGUOUS HANDWRITING

If handwriting cannot be confidently interpreted:

DO NOT guess.

Represent it as uncertain.

For example:

{
  "name": "unclear text",
  "verificationRequired": true
}

If Sarvam provides confidence information, preserve it.

Do not invent confidence values.

---

# 21. PRESCRIPTION DATABASE MODEL

Use Prisma.

The final schema should support:

## Prescription

Fields should include approximately:

    id
    originalFileName
    originalMimeType
    originalFileReference
    status
    sarvamJobId
    rawDigitisedText
    structuredData
    originalLanguage
    createdAt
    updatedAt

Use JSON/JSONB for structured prescription data where appropriate.

---

# 22. TRANSLATION DATABASE MODEL

Create a separate translation model.

Example:

    PrescriptionTranslation

Fields:

    id
    prescriptionId
    targetLanguage
    translatedData
    createdAt
    updatedAt

Relationship:

    Prescription
          |
          +---- PrescriptionTranslation
          |
          +---- PrescriptionTranslation
          |
          +---- PrescriptionTranslation

This allows the same prescription to be translated into:

- Kannada
- Tamil
- Telugu
- Hindi
- English
- etc.

without reprocessing the original document.

---

# 23. PRISMA REQUIREMENTS

Before modifying Prisma:

1. Inspect existing schema.
2. Inspect existing migrations.
3. Preserve existing models.
4. Add only required models/fields.
5. Follow the project's existing Prisma conventions.

Do not delete existing database data.

Do not reset the database.

Do not run destructive commands.

Use normal Prisma migration workflow.

---

# 24. TRANSLATION API

## POST /api/v1/prescriptions/:id/translate

Request:

{
  "targetLanguage": "kn-IN"
}

Flow:

    Prescription
        ↓
    Canonical structured data
        ↓
    Sarvam Translate
        ↓
    Translation
        ↓
    PrescriptionTranslation
        ↓
    Response

Do NOT send the original image to the translation API.

Translate the extracted textual/structured information.

---

# 25. TRANSLATION CACHE

Before calling Sarvam:

Check whether this already exists:

    prescriptionId + targetLanguage

If yes:

return the existing translation.

Do not make unnecessary Sarvam API calls.

---

# 26. LANGUAGE SUPPORT

Support languages based on the current Sarvam API.

At minimum target:

    en-IN
    hi-IN
    kn-IN
    ta-IN
    te-IN
    ml-IN

Verify the exact currently supported language codes from Sarvam documentation before implementation.

Create a single language configuration.

Example:

    lib/sarvam/languages.js

Do not duplicate language codes across files.

---

# 27. MEDICINE NAME HANDLING

Medicine names require special treatment.

Do not blindly translate pharmaceutical names.

For example:

    Metformin 500 mg

should not become an unrelated translated medicine name.

Preserve:

- medicine name
- strength
- numerical values
- dosage
- frequency
- duration

Translate explanatory instructions where appropriate.

The canonical prescription remains unchanged.

---

# 28. SARVAM CLIENT

Create a central Sarvam client.

Example:

    lib/sarvam/client.js

Responsibilities:

- API base URL
- authentication
- headers
- timeout
- error handling
- request IDs
- retry where appropriate

All Sarvam services must use this client.

Do NOT write separate authentication logic in every file.

---

# 29. SARVAM API KEY

Use environment variable:

    SARVAM_API_KEY

Never hard-code the key.

Never:

- commit it
- log it
- return it
- expose it to the browser

Use server-only environment variables.

Do not prefix it with:

    NEXT_PUBLIC_

---

# 30. ENVIRONMENT

The project already has environment setup.

Inspect the existing environment configuration.

Only add missing variables if required.

Expected configuration may include:

    SARVAM_API_KEY=
    SARVAM_BASE_URL=
    DATABASE_URL=

Do not overwrite existing environment variables.

Do not commit secrets.

---

# 31. SARVAM ERROR HANDLING

Normalize Sarvam errors.

Do not expose raw provider responses directly.

Example:

{
  "success": false,
  "error": {
    "code": "SARVAM_DOCUMENT_PROCESSING_FAILED",
    "message": "Unable to process the prescription document."
  }
}

Internally log enough information to debug the problem.

Never expose:

- API keys
- Authorization headers
- internal credentials

---

# 32. RETRIES

Retry only transient failures.

Potential retry candidates:

    429
    500
    502
    503
    504
    network timeout

Do not blindly retry:

    400
    401
    403
    invalid file
    invalid request

Use bounded retries.

Avoid creating duplicate Sarvam jobs.

---

# 33. FILE VALIDATION

Validate:

- file exists
- MIME type
- extension
- file size
- supported format
- non-empty file

Initial supported formats:

    JPEG
    PNG
    PDF

But verify the actual formats supported by the current Sarvam Document Intelligence API.

Do not trust only the client-provided MIME type.

---

# 34. SECURITY

Implement appropriate backend protections.

At minimum:

- request validation
- upload size limits
- safe error messages
- CORS configuration if needed
- secure headers where appropriate
- rate limiting if already supported by the project

Do not expose stack traces in production responses.

---

# 35. RESPONSE FORMAT

All APIs should follow:

Success:

{
  "success": true,
  "data": {}
}

Error:

{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}

Keep responses consistent.

---

# 36. HTTP STATUS CODES

Use appropriate HTTP status codes.

Examples:

    200 OK
    201 Created
    202 Accepted
    400 Bad Request
    404 Not Found
    409 Conflict
    413 Payload Too Large
    415 Unsupported Media Type
    422 Unprocessable Entity
    429 Too Many Requests
    500 Internal Server Error
    502 Bad Gateway
    503 Service Unavailable

---

# 37. NEXT.JS ROUTE HANDLERS

Use Next.js Route Handlers.

Example:

    app/api/v1/prescriptions/route.js

This route handles:

    POST /api/v1/prescriptions

Example:

    app/api/v1/prescriptions/[id]/route.js

This route handles:

    GET /api/v1/prescriptions/:id

Do not create a separate Express application.

---

# 38. SERVER-ONLY SARVAM CODE

All Sarvam API calls must happen server-side.

Never expose Sarvam API credentials to a client.

Do not import Sarvam service modules into client components.

Since this is a backend-only implementation, avoid client components entirely unless an existing project requirement requires them.

---

# 39. PRISMA CLIENT

Use a singleton Prisma client.

Do not instantiate PrismaClient on every request.

Inspect the existing project first.

If a Prisma singleton already exists, reuse it.

If not, create:

    lib/prisma.js

with the appropriate Next.js development-safe singleton pattern.

---

# 40. SERVICE LAYER

Route handlers should remain thin.

Bad:

    route.js
      ↓
    300 lines of Sarvam logic

Good:

    route.js
      ↓
    prescription.service.js
      ↓
    sarvam/document.js
      ↓
    sarvam/client.js

Route handlers are responsible for HTTP concerns.

Services are responsible for business logic.

Sarvam modules are responsible for provider integration.

---

# 41. IMPORTANT: SARVAM RESPONSE ISOLATION

Never couple the entire application to Sarvam's raw response structure.

Use:

    Sarvam response
          ↓
    Sarvam-specific parser
          ↓
    CanonicalPrescription
          ↓
    Application

If Sarvam changes its response structure, only the Sarvam adapter/parser should need modification.

---

# 42. PROCESSING STATE

Implement explicit processing states.

Example:

    CREATED
       ↓
    UPLOADING
       ↓
    DIGITISING
       ↓
    EXTRACTING
       ↓
    COMPLETED

Failure:

    FAILED

Do not allow random state changes.

---

# 43. IDEMPOTENCY

Consider duplicate requests.

A user may accidentally upload the same prescription multiple times.

At minimum:

- persist Sarvam job ID
- persist processing state
- avoid duplicate processing when retrying the same operation
- do not blindly start a new Sarvam job for an existing active job

---

# 44. RAW DATA PRESERVATION

Store three distinct layers:

## Layer 1

Original document reference.

## Layer 2

Raw Sarvam digitised output.

## Layer 3

Canonical structured prescription.

Then:

## Layer 4

Translations.

Never overwrite Layer 2 or Layer 3 with a translation.

Architecture:

    Original document
          ↓
    Sarvam digitisation
          ↓
    Raw digitised output
          ↓
    Canonical prescription
          ↓
    Translation(s)

---

# 45. FUTURE QUESTION API

Prepare architecture for:

    POST /api/v1/prescriptions/:id/questions

Request:

{
  "question": "What was my blood pressure?"
}

The future response:

{
  "success": true,
  "data": {
    "answer": "Your prescription records your blood pressure as 120/80.",
    "source": {
      "field": "vitals.bloodPressure"
    }
  }
}

The question-answering system must retrieve information from the canonical prescription.

---

# 46. QUESTION ANSWERING RULE

If the prescription contains:

    bloodPressure = "120/80"

Question:

    "What was my BP?"

Answer:

    "Your prescription records your blood pressure as 120/80."

If the prescription contains:

    bloodPressure = null

Answer:

    "There is no blood pressure value recorded in this prescription."

Never:

    "Your BP was normal."

Never infer.

---

# 47. FUTURE VOICE FLOW

Do not implement this until Phase 1 is complete.

Future architecture:

    Audio
      ↓
    Sarvam Saaras
      ↓
    Text
      ↓
    Question understanding
      ↓
    Canonical prescription lookup
      ↓
    Grounded answer
      ↓
    Sarvam Bulbul
      ↓
    Audio response

---

# 48. NO RAG

Do NOT add:

- vector database
- embeddings
- Pinecone
- Weaviate
- Qdrant
- Elasticsearch
- LangChain
- LangGraph

for Phase 1.

The prescription is a small structured document.

Normal PostgreSQL/JSON querying is sufficient.

---

# 49. NO UNNECESSARY MICROSERVICES

This is a hackathon backend.

Keep everything inside the Next.js application.

Do not introduce:

- Kafka
- RabbitMQ
- Kubernetes
- separate microservices
- separate AI server

unless there is a demonstrated requirement.

---

# 50. OBSERVABILITY

Use structured logging.

Log:

- request ID
- prescription ID
- operation
- Sarvam job ID
- duration
- status

Do NOT log full medical documents unnecessarily.

Do NOT log API keys.

Do NOT log authorization headers.

---

# 51. HEALTH CHECK

Implement:

    GET /api/health

Response:

{
  "success": true,
  "data": {
    "status": "ok"
  }
}

The health endpoint should not depend on Sarvam being available.

---

# 52. TESTING

At minimum test:

## Upload

- valid JPEG
- valid PNG
- valid PDF
- missing file
- unsupported file
- oversized file
- corrupt file

## Processing

- successful digitisation
- failed digitisation
- successful extraction
- partial extraction
- missing fields
- ambiguous handwriting

## Translation

- English → Kannada
- English → Tamil
- English → Telugu
- unsupported language
- translation API failure

## Database

- prescription creation
- processing state updates
- translation creation
- translation caching
- prescription retrieval

---

# 53. MOCK SARVAM IN TESTS

Unit tests must NOT depend on live Sarvam APIs.

Mock:

- document API
- extraction API
- translation API

Integration tests can use controlled mocks.

---

# 54. POSTMAN

The backend must be easily testable through Postman.

Required endpoints:

    GET /api/health

    POST /api/v1/prescriptions

    GET /api/v1/prescriptions/:id

    GET /api/v1/prescriptions/:id/raw

    POST /api/v1/prescriptions/:id/translate

Future:

    POST /api/v1/prescriptions/:id/questions

    POST /api/v1/prescriptions/:id/voice-question

---

# 55. IMPLEMENTATION ORDER

Follow this exact order.

## STEP 1 — INSPECT

Before writing code:

Inspect:

    package.json
    app/
    lib/
    prisma/schema.prisma
    existing environment configuration
    existing API routes
    existing utilities

Do NOT immediately create files.

Understand what already exists.

---

## STEP 2 — PLAN

Write a short implementation plan based on the actual repository.

Identify:

- reusable code
- missing code
- Prisma changes
- API routes
- Sarvam integrations
- required dependencies

Do not install unnecessary packages.

---

## STEP 3 — PRISMA

Inspect the current schema.

Add the minimum required models for:

    Prescription
    PrescriptionTranslation

Preserve existing schema.

Create a proper migration.

Do NOT reset the database.

---

## STEP 4 — SARVAM CLIENT

Implement:

    lib/sarvam/client.js

Verify authentication.

Verify basic connectivity.

---

## STEP 5 — DOCUMENT INTELLIGENCE

Implement the actual current Sarvam Document Intelligence workflow.

Do not guess the API.

Implement:

    create job
    upload
    process
    poll/check status if required
    retrieve result

Persist the Sarvam job ID.

---

## STEP 6 — DIGITISED OUTPUT

Store:

- raw Sarvam result
- raw text/content
- processing metadata

Do not transform away the original information.

---

## STEP 7 — EXTRACTION

Implement structured extraction.

Map the result to:

    CanonicalPrescription

---

## STEP 8 — DATABASE

Persist:

    structuredData

and:

    rawDigitisedText

---

## STEP 9 — RETRIEVAL

Implement:

    GET /api/v1/prescriptions/:id

and:

    GET /api/v1/prescriptions/:id/raw

---

## STEP 10 — TRANSLATION

Implement:

    POST /api/v1/prescriptions/:id/translate

Use Sarvam Translate.

Add caching.

---

## STEP 11 — ERROR HANDLING

Normalize:

- Sarvam failures
- validation failures
- database failures
- missing prescription
- unsupported language
- invalid document

---

## STEP 12 — TESTING

Run:

    npm test

or the project's existing test command.

Also run:

    npm run lint

and:

    npm run build

if those scripts exist.

Fix every error before declaring completion.

---

# 56. CODE QUALITY

Follow these rules:

- Prefer small functions.
- Keep route handlers thin.
- Keep provider integrations isolated.
- Avoid duplicated logic.
- Avoid giant files.
- Use meaningful names.
- Use async/await.
- Handle rejected promises.
- Validate external API responses.
- Never trust external data blindly.
- Never silently swallow errors.

---

# 57. DO NOT BREAK EXISTING PROJECT

This is critical.

Before changing any existing file:

1. Read it.
2. Understand it.
3. Determine whether it is used elsewhere.
4. Make the smallest safe change.

Do not:

- delete existing functionality
- replace the project architecture
- rewrite unrelated files
- change frontend code unnecessarily
- upgrade dependencies unnecessarily
- reset Prisma
- change database credentials

---

# 58. DEPENDENCY RULE

Before installing a package:

Ask:

> Can this be implemented cleanly using the packages already installed?

If yes, do not install another package.

If a package is genuinely required:

1. Explain why.
2. Install the smallest appropriate dependency.
3. Use the existing project's package manager.

Do not introduce libraries just for convenience.

---

# 59. SARVAM DOCUMENTATION RULE

Sarvam's API can change.

Therefore, before implementing each Sarvam integration:

Check the current official documentation.

Verify:

- endpoint
- HTTP method
- authentication
- headers
- request schema
- response schema
- status lifecycle
- supported formats
- model IDs
- supported languages

Official documentation:

https://docs.sarvam.ai/

The current official documentation overrides this guide if an API detail has changed.

---

# 60. DEFINITION OF DONE

Phase 1 is complete only when:

- [ ] Existing Next.js project remains intact.
- [ ] No NestJS introduced.
- [ ] No separate backend introduced.
- [ ] JavaScript used.
- [ ] Next.js Route Handlers used.
- [ ] Prisma used.
- [ ] PostgreSQL used.
- [ ] Sarvam is the AI provider.
- [ ] Prescription upload works.
- [ ] JPEG works.
- [ ] PNG works.
- [ ] PDF works if supported by Sarvam.
- [ ] Handwritten prescription can be processed.
- [ ] Sarvam Document Intelligence works.
- [ ] Raw digitised output is preserved.
- [ ] Structured extraction works.
- [ ] Canonical prescription is stored.
- [ ] Missing information remains null.
- [ ] No hallucinated prescription data.
- [ ] Translation works.
- [ ] Kannada works.
- [ ] Tamil works.
- [ ] Telugu works.
- [ ] Translation caching works.
- [ ] Prescription retrieval works.
- [ ] Errors are normalized.
- [ ] API key remains server-side.
- [ ] Tests pass.
- [ ] Lint passes.
- [ ] Build passes.
- [ ] Postman can test the APIs.

---

# 61. FINAL INSTRUCTION

DO NOT blindly generate the whole application.

First inspect the repository.

Then provide a concise implementation plan.

Then start writing the code.

Implement one layer at a time:

    Prisma
      ↓
    Sarvam Client
      ↓
    Document Service
      ↓
    Extraction Service
      ↓
    Prescription Service
      ↓
    API Routes
      ↓
    Translation
      ↓
    Tests

After every significant change:

1. Run lint.
2. Run tests.
3. Check the application.
4. Check Prisma.
5. Check the actual Sarvam API contract.
6. Fix errors.
7. Continue.

Do not claim something works unless it has actually been verified.

The goal is NOT maximum code.

The goal is:

> A clean, reliable, production-quality Next.js backend that can receive a handwritten doctor's prescription, use Sarvam AI Document Intelligence to digitise and extract it, store the structured prescription in PostgreSQL through Prisma, and translate it into Indian languages through Sarvam AI.