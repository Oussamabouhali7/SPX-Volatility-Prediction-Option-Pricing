const fs = require("fs");
let c = fs.readFileSync("/app/src/pages/Evaluation.jsx", "utf8");

c = c.replace(
  "      <Typography variant=\"h1\" gutterBottom>",
  `      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="body1">Afficher les</Typography>
        <TextField type="number" size="small" value={maxWin}
          onChange={e => setMaxWin(Math.min(54, Math.max(1, parseInt(e.target.value) || 1)))}
          inputProps={{ min: 1, max: 54 }} sx={{ width: 80 }} />
        <Typography variant="body1">premieres fenetres sur 54</Typography>
        <Chip label={\`\${filteredWindows.length > 0 ? Math.max(...filteredWindows.map(w=>w.window_id)) : 0} fenetres affichees\`}
          sx={{ bgcolor: PWC_COLORS.orange + '20', color: PWC_COLORS.orange }} />
      </Box>
      <Typography variant="h1" gutterBottom>`
);

fs.writeFileSync("/app/src/pages/Evaluation.jsx", c);
console.log("OK");
