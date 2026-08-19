const fs = require("fs");
let c = fs.readFileSync("/app/src/api/client.js", "utf8");
// Remplacer toute la fonction getSurface
const oldFn = /export const getSurface.*?\.then\(\(r\) => r\.data\);?\n?\}?/s;
const newFn = `export const getSurface = (date_obs_raw, model_name) => {
  const date_obs = date_obs_raw ? date_obs_raw.replace(/^\\[.*?\\]\\s*/, '') : date_obs_raw;
  return api.get('/surface', { params: { date_obs, model_name } }).then((r) => r.data);
};`;
c = c.replace(oldFn, newFn);
fs.writeFileSync("/app/src/api/client.js", c);
console.log("OK");
console.log(c.substring(c.indexOf("getSurface"), c.indexOf("getSurface") + 200));
