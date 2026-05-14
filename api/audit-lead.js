const LEAD_EMAIL = process.env.LEAD_EMAIL || "support@arcargen.ai";

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function formatRatings(ratings = {}) {
  return Object.entries(ratings)
    .map(([area, score]) => `${area}: ${score}/5`)
    .join("\n");
}

function formatPriorities(priorities = []) {
  return priorities
    .map((item, index) => {
      const dollars = Number(item.dollars || 0).toLocaleString("en-US");
      return `${index + 1}. ${item.area}: ${item.hours} hrs/wk, $${dollars}/yr`;
    })
    .join("\n");
}

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const lead = body && body.lead ? body.lead : {};
    const result = body && body.result ? body.result : {};

    if (!lead.business || !lead.email || !lead.industry || !lead.employees) {
      sendJson(response, 400, { error: "Missing required lead fields" });
      return;
    }

    const submittedAt = new Date().toISOString();
    const annualValue = Number(result.annualValue || 0).toLocaleString("en-US");
    const formData = new URLSearchParams({
      _subject: `New Arcagen audit lead: ${lead.business}`,
      _template: "table",
      _captcha: "false",
      submittedAt,
      business: lead.business,
      email: lead.email,
      industry: lead.industry,
      employees: lead.employees,
      estimatedHoursPerWeek: String(result.hoursPerWeek || ""),
      estimatedAnnualValue: annualValue ? `$${annualValue}` : "",
      benchmarkContext: result.context || "",
      painRatings: formatRatings(lead.ratings),
      priorityAutomations: formatPriorities(result.priorities),
      source: body.source || "arcagen.ai audit"
    });

    const formSubmitResponse = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(LEAD_EMAIL)}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData
    });

    if (!formSubmitResponse.ok) {
      const errorText = await formSubmitResponse.text();
      console.error("Lead forwarding failed", formSubmitResponse.status, errorText);
      sendJson(response, 502, { error: "Lead forwarding failed" });
      return;
    }

    sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error("Audit lead capture failed", error);
    sendJson(response, 500, { error: "Lead capture failed" });
  }
};
