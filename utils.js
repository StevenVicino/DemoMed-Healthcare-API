async function fetchPatients(
  page = 1,
  limit = 5,
  baseURL = "https://assessment.ksensetech.com/api",
  apiKey,
  maxRetries
) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const res = await fetch(
        `${baseURL}/patients?page=${page}&limit=${limit}`,
        {
          headers: { "x-api-key": apiKey },
        }
      );

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after") || 2000;
        console.log(`Rate limited. Retrying after ${retryAfter}ms...`);
        await sleep(retryAfter);
        continue;
      }

      if (res.status === 500 || res.status === 503) {
        throw new Error("Server error, will retry...");
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      return await res.json();
    } catch (err) {
      retries++;
      const delay = 1000 * Math.pow(2, retries);
      console.log(`Retry ${retries}/${maxRetries} after error: ${err.message}`);
      await sleep(delay);
    }
  }

  throw new Error(`Failed to fetch page ${page} after ${MAX_RETRIES} retries.`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBloodPressure(bpString) {
  if (!bpString || typeof bpString !== "string") return null;
  const [sys, dia] = bpString.split("/").map(Number);
  return isNaN(sys) || isNaN(dia) ? null : { sys, dia };
}

function bpRisk(bp) {
  if (!bp) return 0;
  const { sys, dia } = bp;
  if (sys < 120 && dia < 80) return 0;
  if (sys >= 120 && sys <= 129 && dia < 80) return 1;
  if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) return 2;
  if (sys >= 140 || dia >= 90) return 3;
  return 0;
}

function tempRisk(temp) {
  if (temp == null || isNaN(temp)) return 0;
  if (temp <= 99.5) return 0;
  if (temp <= 100.9) return 1;
  if (temp >= 101) return 2;
  return 0;
}

function ageRisk(age) {
  if (age == null || isNaN(age)) return 0;
  if (age < 40) return 0;
  if (age <= 65) return 1;
  if (age > 65) return 2;
  return 0;
}

async function submitAssessment(results, baseURL, apiKey) {
  const res = await fetch(`${baseURL}/submit-assessment`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(results),
  });

  if (!res.ok) {
    throw new Error(`Submission failed: ${res.status} ${await res.text()}`);
  }

  const responseData = await res.json();
  console.log("Submission successful:", responseData);
  console.dir(responseData, { depth: null, colors: true });
}

export {
  fetchPatients,
  parseBloodPressure,
  bpRisk,
  tempRisk,
  ageRisk,
  submitAssessment,
};
