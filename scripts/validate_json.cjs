const fs = require("fs");
const path = require("path");

const files = ["en.json", "es.json", "pt-BR.json"];
for (const f of files) {
  const p = path.join(__dirname, "..", f);
  const raw = fs.readFileSync(p, "utf8");
  const data = JSON.parse(raw);
  console.log(`${f}: OK (${Object.keys(data).length} top-level keys)`);
}
console.log("JSON_VALID");
