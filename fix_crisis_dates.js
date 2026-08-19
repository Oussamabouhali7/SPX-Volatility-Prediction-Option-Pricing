const fs = require("fs");
let c = fs.readFileSync("/app/src/api/client.js", "utf8");
c = c.replace(
  "export const getSurface = (date_obs, model_name) =>",
  "export const getSurface = (date_obs_raw, model_name) => {\n  const date_obs = date_obs_raw ? date_obs_raw.replace(/^\\[.*?\\]\\s*/, '') : date_obs_raw;\n  return "
);
c = c.replace(
  "  api.get('/surface', { params: { date_obs, model_name } }).then((r) => r.data);",
  "  api.get('/surface', { params: { date_obs, model_name } }).then((r) => r.data);\n}"
);
fs.writeFileSync("/app/src/api/client.js", c);
console.log("OK");
