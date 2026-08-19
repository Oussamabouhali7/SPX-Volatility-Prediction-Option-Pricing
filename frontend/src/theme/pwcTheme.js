// theme/pwcTheme.js — Palette PwC
import { createTheme } from '@mui/material/styles';

export const PWC_COLORS = {
  orange: '#DC6B2F',           // PwC Orange (primaire)
  orangeDark: '#A04A1D',
  orangeLight: '#FFB592',
  yellow: '#FFB600',
  red: '#E0301E',
  rose: '#D04A02',
  greyDark: '#2D2D2D',
  greyMedium: '#7D7D7D',
  greyLight: '#E5E5E5',
  greyBg: '#F5F5F5',
  white: '#FFFFFF',
  black: '#000000',
};

export const pwcTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: PWC_COLORS.orange,
      dark: PWC_COLORS.orangeDark,
      light: PWC_COLORS.orangeLight,
      contrastText: PWC_COLORS.white,
    },
    secondary: {
      main: PWC_COLORS.greyDark,
      contrastText: PWC_COLORS.white,
    },
    error: { main: PWC_COLORS.red },
    warning: { main: PWC_COLORS.yellow },
    background: {
      default: PWC_COLORS.greyBg,
      paper: PWC_COLORS.white,
    },
    text: {
      primary: PWC_COLORS.greyDark,
      secondary: PWC_COLORS.greyMedium,
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 700, fontSize: '2rem' },
    h2: { fontWeight: 700, fontSize: '1.6rem' },
    h3: { fontWeight: 600, fontSize: '1.3rem' },
    h4: { fontWeight: 600, fontSize: '1.1rem' },
    h5: { fontWeight: 500, fontSize: '1rem' },
    h6: { fontWeight: 500, fontSize: '0.9rem' },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 6, textTransform: 'none' },
        containedPrimary: {
          backgroundColor: PWC_COLORS.orange,
          '&:hover': { backgroundColor: PWC_COLORS.orangeDark },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: PWC_COLORS.white,
          color: PWC_COLORS.greyDark,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.95rem',
          minHeight: 56,
        },
      },
    },
  },
});

export default pwcTheme;
