const baseUrl = (process.env.SMOKE_BASE_URL || process.env.SMOKE_UI_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function postJson(path, body) {
  const request = async () => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };
  return withRetry(request, `POST ${path}`);
}

async function getJson(path) {
  const request = async () => {
    const response = await fetch(`${baseUrl}${path}`);
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };
  return withRetry(request, `GET ${path}`);
}

async function withRetry(fn, label, attempts = 4) {
  let lastError = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const result = await fn();
      if (result?.response?.status >= 500 && i < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * i));
        continue;
      }
      return result;
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * i));
        continue;
      }
      throw error;
    }
  }

  if (lastError) throw lastError;
  throw new Error(`${label}: retry_exhausted`);
}

function pickFirstOption(questions, questionIndex) {
  const question = questions.find((q) => q.orderIndex === questionIndex);
  if (!question || !Array.isArray(question.options) || question.options.length < 1) {
    return null;
  }
  return {
    questionId: question.id,
    optionId: question.options[0].id,
  };
}

async function main() {
  console.log(`Dosha API flow smoke base URL: ${baseUrl}`);

  const definition = await getJson("/api/tests/dosha-test");
  if (!definition.response.ok || !Array.isArray(definition.data?.questions)) {
    fail(`definition failed: status=${definition.response.status}`);
    console.log(definition.data);
    return;
  }
  pass("definition returned questions");

  const totalQuestions = Number(definition.data.totalQuestions ?? 0);
  const questions = Array.isArray(definition.data.questions) ? definition.data.questions : [];

  if (totalQuestions !== 12) {
    fail(`expected 12 questions, got ${totalQuestions}`);
  } else {
    pass("totalQuestions=12");
  }

  const answers = [];
  for (let i = 1; i <= totalQuestions; i += 1) {
    const picked = pickFirstOption(questions, i);
    if (!picked) {
      fail(`missing option payload for question index ${i}`);
      return;
    }
    answers.push(picked);
  }

  const complete = await postJson("/api/tests/dosha-test/complete", {
    source: "smoke_dosha_api_flow",
    sessionId: `smoke-${Date.now()}`,
    answers,
  });

  if (!complete.response.ok || !complete.data?.attemptId) {
    fail(`complete failed: status=${complete.response.status}`);
    console.log(complete.data);
    return;
  }

  const attemptId = complete.data.attemptId;
  if (!complete.data?.isCompleted) {
    fail("completion payload did not mark isCompleted");
  } else {
    pass("completion payload marks isCompleted");
  }
  if (!complete.data?.resultType) {
    fail("completion payload missing resultType");
  } else {
    pass("completion payload has resultType");
  }
  if (!complete.data?.completedAt) {
    fail("completion payload missing completedAt");
  } else {
    pass("completion payload has completedAt");
  }
  if (!complete.data?.nextStep) {
    fail("completion payload missing nextStep");
  } else {
    pass("completion payload has nextStep");
  }

  const completedAttempt = await getJson(`/api/test-attempts/${attemptId}`);
  if (!completedAttempt.response.ok) {
    fail(`GET completed attempt failed: status=${completedAttempt.response.status}`);
  } else {
    const status = completedAttempt.data?.status;
    if (status !== "completed") {
      fail(`expected completed status, got ${String(status)}`);
    } else {
      pass("completed attempt persisted");
    }

    if (!completedAttempt.data?.resultPayload?.completedAt) {
      fail("attempt resultPayload.completedAt is missing");
    } else {
      pass("attempt resultPayload.completedAt exists");
    }
  }

  const restart = await postJson("/api/tests/dosha-test/restart", {
    previousAttemptId: attemptId,
    source: "smoke_dosha_api_flow_restart",
  });

  if (!restart.response.ok) {
    fail(`restart failed: status=${restart.response.status}`);
  } else if (restart.data?.attemptId !== null) {
    fail("restart should be metadata-only and return attemptId=null");
  } else {
    pass("restart returned metadata-only payload");
  }

  if (process.exitCode) process.exit(process.exitCode);
  console.log("Dosha API flow smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
