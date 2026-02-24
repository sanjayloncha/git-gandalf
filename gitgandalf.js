import fetch from "node-fetch";

process.stdin.setEncoding("utf8");

let diff = "";

process.stdin.on("data", chunk => {
    diff += chunk;
});

process.stdin.on("end", async () => {
    if (!diff.trim()) {
        process.exit(0);
    }

    // Deterministic keyword checks
    const isSelfModification = diff.includes("gitgandalf.js");

    const addedLines = diff
        .split("\n")
        .filter(line => line.startsWith("+") && !line.startsWith("+++"))
        .join("\n");

    if (!isSelfModification &&
        (addedLines.includes("password") ||
            addedLines.includes("SECRET") ||
            addedLines.includes("API_KEY"))
    ) {
        console.log("Sensitive keyword detected in added lines. Blocking commit.");
        process.exit(1);
    }

    // Diff size check
    if (diff.length > 8000) {
        console.log("Diff too large for safe automated review. Blocking commit.");
        process.exit(1);
    }

    const prompt = `
You are a senior software engineer reviewing a git commit.

Review the following git diff and assess risk.

Return ONLY valid JSON in this format:
{
  "risk": "LOW | MEDIUM | HIGH",
  "summary": "string"
}

Git diff:
${diff}
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
        const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "qwen2.5-coder-1.5b-instruct",
                messages: [{ role: "user", content: prompt }],
                temperature: 0
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            console.log(`LLM HTTP error: ${response.status}. Blocking commit.`);
            process.exit(1);
        }

        const data = await response.json();

        if (!data?.choices?.[0]?.message?.content) {
            console.log("Invalid LLM response structure. Blocking commit.");
            process.exit(1);
        }

        let text = data.choices[0].message.content.trim();

        // Remove markdown fences if present
        if (text.startsWith("```")) {
            text = text.replace(/```json|```/gi, "").trim();
        }

        let result;
        try {
            result = JSON.parse(text);
        } catch {
            console.log("Invalid JSON from LLM. Blocking commit.");
            process.exit(1);
        }

        const normalizedRisk = result?.risk?.trim().toUpperCase();

        if (!["LOW", "MEDIUM", "HIGH"].includes(normalizedRisk)) {
            console.log("Unexpected risk level. Blocking commit.");
            process.exit(1);
        }

        console.log("🧙 Git Gandalf Review");
        console.log("Risk:", normalizedRisk);
        console.log("Summary:", result.summary);

        if (normalizedRisk === "HIGH") {
            process.exit(1);
        }

        process.exit(0);

    } catch (err) {
        if (err.name === "AbortError") {
            console.log("LLM request timed out. Blocking commit.");
        } else {
            console.log("LLM connection error. Blocking commit.");
        }
        process.exit(1);
    }
});