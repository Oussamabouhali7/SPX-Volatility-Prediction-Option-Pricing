import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Paper, TextField, Button, Alert, Typography, CircularProgress, InputAdornment, IconButton, Divider, Tabs, Tab } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { login } from "../api/client";
import PwCLogo from "../components/PwCLogo";
import { PWC_COLORS } from "../theme/pwcTheme";

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Identifiants incorrects.");
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (newPassword !== newPassword2) { setError("Les mots de passe ne correspondent pas."); return; }
    if (newPassword.length < 6) { setError("Mot de passe trop court (6 caractères minimum)."); return; }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/auth/register", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:newUsername,email:newEmail,password:newPassword})});const data = await res.json();if(!res.ok) throw new Error(data.detail);
      setSuccess("Compte créé avec succès ! Vous pouvez vous connecter.");
      setTab(0);
      setUsername(newUsername);
      setNewUsername(""); setNewEmail(""); setNewPassword(""); setNewPassword2("");
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de la création du compte.");
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: PWC_COLORS.greyBg, p: 2 }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 460, width: "100%", borderRadius: 2, borderTop: `4px solid ${PWC_COLORS.orange}` }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}><PwCLogo size={52} /></Box>
        <Typography variant="h5" align="center" fontWeight={700} gutterBottom>Volatility AI Lab</Typography>

        <Tabs value={tab} onChange={(e, v) => { setTab(v); setError(""); setSuccess(""); }} centered sx={{ mb: 2, "& .MuiTab-root.Mui-selected": { color: PWC_COLORS.orange }, "& .MuiTabs-indicator": { bgcolor: PWC_COLORS.orange } }}>
          <Tab label="Connexion" />
          <Tab label="Créer un compte" icon={<PersonAddIcon fontSize="small" />} iconPosition="start" />
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

        {tab === 0 && (
          <form onSubmit={handleLogin}>
            <TextField fullWidth label="Nom utilisateur" margin="normal" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required
              InputProps={{ startAdornment: (<InputAdornment position="start"><LockOutlinedIcon sx={{ color: PWC_COLORS.orange, fontSize: 20 }} /></InputAdornment>) }} />
            <TextField fullWidth label="Mot de passe" type={showPassword ? "text" : "password"} margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} required
              InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)} edge="end">{showPassword ? <VisibilityOffIcon sx={{ color: PWC_COLORS.orange }} /> : <VisibilityIcon sx={{ color: PWC_COLORS.greyMid }} />}</IconButton></InputAdornment>) }} />
            <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3, height: 50, fontWeight: 700, bgcolor: PWC_COLORS.orange, "&:hover": { bgcolor: "#b85520" } }} disabled={loading}>
              {loading ? <CircularProgress size={24} color="inherit" /> : "Se connecter"}
            </Button>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ bgcolor: PWC_COLORS.greyBg, borderRadius: 1, p: 1.5, border: `1px solid ${PWC_COLORS.greyLight}` }}>
              <Typography variant="caption" color="text.secondary" display="block" align="center">Compte administrateur par défaut</Typography>
              <Typography variant="caption" fontWeight={700} display="block" align="center" sx={{ mt: 0.5 }}>
                Identifiant : <span style={{ color: PWC_COLORS.orange }}>admin</span> | Mot de passe : <span style={{ color: PWC_COLORS.orange }}>PwC2024!</span>
              </Typography>
            </Box>
          </form>
        )}

        {tab === 1 && (
          <form onSubmit={handleRegister}>
            <TextField fullWidth label="Nom utilisateur" margin="normal" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} autoFocus required />
            <TextField fullWidth label="Email" type="email" margin="normal" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            <TextField fullWidth label="Mot de passe" type={showPassword ? "text" : "password"} margin="normal" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required
              InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)} edge="end">{showPassword ? <VisibilityOffIcon sx={{ color: PWC_COLORS.orange }} /> : <VisibilityIcon sx={{ color: PWC_COLORS.greyMid }} />}</IconButton></InputAdornment>) }} />
            <TextField fullWidth label="Confirmer mot de passe" type={showPassword2 ? "text" : "password"} margin="normal" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} required
              InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton onClick={() => setShowPassword2(!showPassword2)} edge="end">{showPassword2 ? <VisibilityOffIcon sx={{ color: PWC_COLORS.orange }} /> : <VisibilityIcon sx={{ color: PWC_COLORS.greyMid }} />}</IconButton></InputAdornment>) }} />
            <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3, height: 50, fontWeight: 700, bgcolor: PWC_COLORS.orange, "&:hover": { bgcolor: "#b85520" } }} disabled={loading}>
              {loading ? <CircularProgress size={24} color="inherit" /> : "Créer mon compte"}
            </Button>
            <Typography variant="caption" color="text.secondary" display="block" align="center" sx={{ mt: 2 }}>
              Note : Le compte sera créé avec les droits utilisateur standard.
            </Typography>
          </form>
        )}
      </Paper>
    </Box>
  );
}
 
 
 
