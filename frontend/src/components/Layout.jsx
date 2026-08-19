// components/Layout.jsx — Sidebar + topbar + zone de contenu
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Drawer, List, ListItemButton, ListItemIcon,
  ListItemText, IconButton, Typography, Menu, MenuItem, Avatar, Divider,
} from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import CalculateIcon from '@mui/icons-material/Calculate';
import LayersIcon from '@mui/icons-material/Layers';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import SchoolIcon from '@mui/icons-material/School';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BuildIcon from '@mui/icons-material/Build';
import LogoutIcon from '@mui/icons-material/Logout';
import GroupIcon from '@mui/icons-material/Group';
import { logout, getCurrentUser } from '../api/client';
import PwCLogo from './PwCLogo';
import { PWC_COLORS } from '../theme/pwcTheme';

const DRAWER_WIDTH = 240;

const MENU = [
  { path: '/', icon: <TimelineIcon />, label: 'Prédiction IV' },
  { path: '/pricing', icon: <CalculateIcon />, label: 'Valorisation d\'option' },
  { path: '/surface', icon: <LayersIcon />, label: 'Nappe de volatilité' },
  { path: '/evaluation', icon: <DashboardIcon />, label: 'Évaluation des modèles' },
  { path: '/eda' , icon: <BarChartIcon /> , label: 'Exploration EDA' },
  { path: '/data-preparation', icon: <BuildIcon />, label: 'Préparation des données' },
  { path: '/methodology', icon: <SchoolIcon />, label: 'Méthodologie' },
  { path: '/surface-methodology', icon: <ShowChartIcon />, label: 'Méthodologie Nappe' },

];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const [menuEl, setMenuEl] = useState(null);

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Top bar */}
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <PwCLogo size={32} />
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" sx={{ mr: 1.5, color: PWC_COLORS.greyMedium }}>
            {user?.username} {user?.is_admin && '(admin)'}
          </Typography>
          <IconButton onClick={(e) => setMenuEl(e.currentTarget)}>
            <Avatar sx={{ bgcolor: PWC_COLORS.orange, width: 36, height: 36, fontSize: 14 }}>
              {user?.username?.charAt(0)?.toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={menuEl} open={Boolean(menuEl)}
            onClose={() => setMenuEl(null)}
          >
            {user?.is_admin && (
              <MenuItem onClick={() => { setMenuEl(null); navigate('/admin'); }}>
                <GroupIcon sx={{ mr: 1, fontSize: 20 }} /> Gestion utilisateurs
              </MenuItem>
            )}
            <MenuItem onClick={() => { setMenuEl(null); logout(); }}>
              <LogoutIcon sx={{ mr: 1, fontSize: 20 }} /> Déconnexion
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: `1px solid ${PWC_COLORS.greyLight}`,
            bgcolor: PWC_COLORS.white,
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', mt: 1 }}>
          <List>
            {MENU.map((item) => {
              const active = location.pathname === item.path;
              return (
                <ListItemButton
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    py: 1.2, mx: 1, mb: 0.5, borderRadius: 1,
                    bgcolor: active ? PWC_COLORS.orange : 'transparent',
                    color: active ? PWC_COLORS.white : PWC_COLORS.greyDark,
                    '&:hover': {
                      bgcolor: active ? PWC_COLORS.orangeDark : PWC_COLORS.greyLight,
                    },
                  }}
                >
                  <ListItemIcon sx={{
                    color: active ? PWC_COLORS.white : PWC_COLORS.greyMedium,
                    minWidth: 40,
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
                </ListItemButton>
              );
            })}
          </List>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ px: 2, mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Cycle de vie CRISP-DM
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1, color: PWC_COLORS.greyMedium }}>
              1. Compréhension du métier
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              2. Compréhension des données
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              3. Préparation des données
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              4. Modélisation
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              5. Évaluation
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: PWC_COLORS.orange, fontWeight: 600 }}>
              6. Déploiement ←
            </Typography>
          </Box>
        </Box>
      </Drawer>

      {/* Content */}
      <Box component="main" sx={{
        flexGrow: 1, p: 3, mt: 8,
        minHeight: '100vh', bgcolor: PWC_COLORS.greyBg,
      }}>
        <Outlet />
      </Box>
    </Box>
  );
}