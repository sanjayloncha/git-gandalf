import fetch from "node-fetch";

process.stdin.setEncoding("utf8");

let diff = "";

process.stdin.on("data", chunk => {
    diff += chunk;
});

process.stdin.on("data", chunk => {
  console.log("STDIN:", chunk.toString());
});


process.stdin.on("end", async () => {
    if (!diff.trim()) {
        process.exit(0);
    }

    if (
        diff.includes("password") ||
        diff.includes("SECRET") ||
        diff.includes("API_KEY")
    ) {
        console.log("Sensitive keyword detected. Blocking commit.");
        process.exit(1);
    }

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
            })
        });

        const data = await response.json();
        const text = data.choices[0].message.content;

        const result = JSON.parse(text);

        console.log("🧙 Git Gandalf Review");
        console.log("Risk:", result.risk);
        console.log("Summary:", result.summary);

        if (result.risk === "HIGH") {
            process.exit(1);
        }

        process.exit(0);

    } catch (err) {
        console.log("LLM error. Blocking commit.");
        process.exit(1);
    }
});
