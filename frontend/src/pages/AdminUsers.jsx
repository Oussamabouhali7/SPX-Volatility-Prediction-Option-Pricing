// pages/AdminUsers.jsx — CRUD utilisateurs (admin only)
import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Switch, FormControlLabel,
  Alert, Chip, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { listUsers, createUser, updateUser, deleteUser } from '../api/client';
import { PWC_COLORS } from '../theme/pwcTheme';


export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', email: '', password: '', is_admin: false });

  const load = () => {
    listUsers().then(setUsers).catch(e => setError(e.response?.data?.detail || 'Erreur'));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ username: '', email: '', password: '', is_admin: false });
    setOpen(true);
  };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ username: u.username, email: u.email, password: '', is_admin: u.is_admin });
    setOpen(true);
  };

  const handleSave = async () => {
    setError('');
    try {
      if (editing) {
        const payload = {};
        if (form.email !== editing.email) payload.email = form.email;
        if (form.password) payload.password = form.password;
        if (form.is_admin !== editing.is_admin) payload.is_admin = form.is_admin;
        await updateUser(editing.id, payload);
      } else {
        await createUser(form);
      }
      setOpen(false);
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Erreur'); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Supprimer ${u.username} ?`)) return;
    try {
      await deleteUser(u.id);
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Erreur'); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h1">Gestion des utilisateurs</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nouvel utilisateur
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>ID</strong></TableCell>
              <TableCell><strong>Username</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Rôle</strong></TableCell>
              <TableCell><strong>État</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>{u.id}</TableCell>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Chip
                    label={u.is_admin ? 'Admin' : 'Utilisateur'}
                    size="small"
                    sx={{
                      bgcolor: u.is_admin ? PWC_COLORS.orange : PWC_COLORS.greyLight,
                      color: u.is_admin ? '#fff' : PWC_COLORS.greyDark,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip label={u.is_active ? 'Actif' : 'Désactivé'} size="small"
                        color={u.is_active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => openEdit(u)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton onClick={() => handleDelete(u)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? `Éditer ${editing.username}` : 'Nouvel utilisateur'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Username" margin="dense"
            value={form.username} onChange={(e) => setForm({...form, username: e.target.value})}
            disabled={!!editing} />
          <TextField fullWidth label="Email" margin="dense"
            value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
          <TextField fullWidth label={editing ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}
            type="password" margin="dense"
            value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} />
          <FormControlLabel
            control={<Switch checked={form.is_admin}
              onChange={(e) => setForm({...form, is_admin: e.target.checked})} />}
            label="Administrateur" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
