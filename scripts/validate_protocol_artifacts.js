import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();
const protocolDir = path.join(root, "protocol");

function readJson(...parts) {
  const filePath = path.join(protocolDir, ...parts);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Hex(value) {
  return `0x${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateWithSchema(ajv, schemaName, documentName) {
  const schema = readJson("schemas", schemaName);
  const document = readJson(...documentName);
  const validate = ajv.compile(schema);
  const valid = validate(document);
  assert(valid, `${documentName.join("/")} failed schema validation: ${ajv.errorsText(validate.errors)}`);
  return document;
}

function validateDomainBundle(ajv, domainId) {
  const domain = validateWithSchema(ajv, "domain_spec.schema.json", [
    "domains",
    `${domainId}.json`
  ]);
  const caseObject = validateWithSchema(ajv, "case_object.schema.json", [
    "examples",
    `${domainId}.case_object.example.json`
  ]);
  const assessment = validateWithSchema(ajv, "assessment_artifact.schema.json", [
    "examples",
    `${domainId}.assessment_artifact.example.json`
  ]);
  const judgment = validateWithSchema(ajv, "judgment_object.schema.json", [
    "examples",
    `${domainId}.judgment_object.example.json`
  ]);

  const expectedEvidencePolicyHash = sha256Hex(canonicalJson(domain.evidence_policy));
  const expectedEvaluationSpecHash = sha256Hex(canonicalJson(domain.evaluation_spec));
  const expectedModelPolicyHash = sha256Hex(canonicalJson(domain.model_policy));
  const expectedEquivalenceProfileHash = sha256Hex(canonicalJson(domain.equivalence_profile));
  const expectedRevisionPolicyHash = sha256Hex(canonicalJson(domain.revision_policy));
  const expectedDomainSpecHash = sha256Hex(
    canonicalJson({
      ...domain,
      policy_hashes: undefined
    })
  );

  assert(
    domain.policy_hashes.evidence_policy_hash === expectedEvidencePolicyHash,
    `${domainId} evidence_policy_hash does not match canonical hash`
  );
  assert(
    domain.policy_hashes.evaluation_spec_hash === expectedEvaluationSpecHash,
    `${domainId} evaluation_spec_hash does not match canonical hash`
  );
  assert(
    domain.policy_hashes.model_policy_hash === expectedModelPolicyHash,
    `${domainId} model_policy_hash does not match canonical hash`
  );
  assert(
    domain.policy_hashes.equivalence_profile_hash === expectedEquivalenceProfileHash,
    `${domainId} equivalence_profile_hash does not match canonical hash`
  );
  assert(
    domain.policy_hashes.revision_policy_hash === expectedRevisionPolicyHash,
    `${domainId} revision_policy_hash does not match canonical hash`
  );
  assert(
    domain.policy_hashes.domain_spec_hash === expectedDomainSpecHash,
    `${domainId} domain_spec_hash does not match canonical hash`
  );

  assert(
    caseObject.source_reference.domain_spec_hash === domain.policy_hashes.domain_spec_hash,
    `${domainId} case object domain_spec_hash does not match domain`
  );
  assert(
    caseObject.source_reference.evidence_policy_hash === domain.policy_hashes.evidence_policy_hash,
    `${domainId} case object evidence_policy_hash does not match domain`
  );
  assert(caseObject.domain_id === domain.domain_id, `${domainId} case object domain_id mismatch`);

  const expectedOutcomePayloadHash = sha256Hex(canonicalJson(assessment.outcome_payload));
  assert(
    assessment.outcome_payload_hash === expectedOutcomePayloadHash,
    `${domainId} assessment outcome_payload_hash does not match canonical hash`
  );
  assert(
    assessment.domain_spec_hash === domain.policy_hashes.domain_spec_hash,
    `${domainId} assessment domain_spec_hash does not match domain`
  );
  assert(
    assessment.evaluation_spec_hash === domain.policy_hashes.evaluation_spec_hash,
    `${domainId} assessment evaluation_spec_hash does not match domain`
  );
  assert(
    assessment.model_policy_hash === domain.policy_hashes.model_policy_hash,
    `${domainId} assessment model_policy_hash does not match domain`
  );

  const expectedAssessmentHash = sha256Hex(canonicalJson(assessment));
  assert(
    judgment.assessment_hash === expectedAssessmentHash,
    `${domainId} judgment assessment_hash does not match assessment canonical hash`
  );
  assert(judgment.case_id === caseObject.case_id, `${domainId} judgment case_id mismatch`);
  assert(judgment.domain_id === domain.domain_id, `${domainId} judgment domain_id mismatch`);

  return {
    domain_id: domain.domain_id,
    hashes: {
      domain_spec_hash: expectedDomainSpecHash,
      evidence_policy_hash: expectedEvidencePolicyHash,
      evaluation_spec_hash: expectedEvaluationSpecHash,
      model_policy_hash: expectedModelPolicyHash,
      equivalence_profile_hash: expectedEquivalenceProfileHash,
      revision_policy_hash: expectedRevisionPolicyHash,
      assessment_hash: expectedAssessmentHash,
      outcome_payload_hash: expectedOutcomePayloadHash
    }
  };
}

function main() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validated = [
    "counterparty_trust.base_trade_v1",
    "protocol_safety.base_erc20_permission_v1"
  ].map((domainId) => validateDomainBundle(ajv, domainId));

  const summary = {
    ok: true,
    domain_ids: validated.map((item) => item.domain_id),
    domains: validated
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();
