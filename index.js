import dotenv from "dotenv";
dotenv.config();

import {
  fetchPatients,
  parseBloodPressure,
  bpRisk,
  tempRisk,
  ageRisk,
  submitAssessment,
} from "./utils.js";

const API_KEY = process.env.API_KEY;
const BASE_URL = "https://assessment.ksensetech.com/api";
const MAX_RETRIES = 5;

if (!API_KEY) {
  console.error("ERROR: Missing API_KEY environment variable.");
  process.exit(1);
}

async function main() {
  const allPatients = [];
  let page = 1;
  let limit = 5;
  let hasNext = true;

  while (hasNext) {
    const result = await fetchPatients(
      page,
      limit,
      BASE_URL,
      API_KEY,
      MAX_RETRIES
    );
    if (result?.data?.length) {
      allPatients.push(...result.data);
      console.log(JSON.stringify(result.pagination));
      page++;
    }
    if (result?.pagination?.hasNext === false) {
      hasNext = false;
    }
  }

  const highRisk = [];
  const feverPatients = [];
  const dataQualityIssues = [];

  for (const patient of allPatients) {
    const bp = parseBloodPressure(patient.blood_pressure);
    const temp = parseFloat(patient.temperature);
    const age = parseInt(patient.age);

    let invalid = false;
    if (!bp || isNaN(temp) || isNaN(age)) {
      invalid = true;
      dataQualityIssues.push(patient.patient_id);
    }

    if (!invalid) {
      const risk = bpRisk(bp) + tempRisk(temp) + ageRisk(age);
      if (risk >= 4) highRisk.push(patient.patient_id);
    }

    if (temp && temp >= 99.6) feverPatients.push(patient.patient_id);
  }

  const submission = {
    high_risk_patients: highRisk,
    fever_patients: feverPatients,
    data_quality_issues: dataQualityIssues,
  };
  console.log(JSON.stringify(allPatients));
  console.log("Submitting this payload:\n", submission);
  await submitAssessment(submission, BASE_URL, API_KEY);
}

main().catch((err) => {
  console.error("Fatal error:", err);
});
