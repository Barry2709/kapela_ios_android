const fs = require('fs');

const files = [
  'src/app/(auth)/onboarding.tsx',
  'src/components/setlist-editor-modal.tsx',
  'src/components/stageplan-modal.tsx',
  'src/components/song-lyrics-viewer.tsx',
  'src/components/tuner-modal.tsx',
  'src/components/audio-recorder.tsx',
  'src/components/edit-band-form.tsx',
  'src/app/(tabs)/manage-band.tsx',
  'src/components/add-member-form.tsx',
  'src/components/add-inquiry-form.tsx'
];

files.forEach(f => {
  let d = fs.readFileSync(f, 'utf8');
  if (!d.includes('useTranslation')) {
    d = d.replace(/import \{ useTheme \} from '@\/hooks\/use-theme';/g, "import { useTheme } from '@/hooks/use-theme';\nimport { useTranslation } from '@/utils/i18n';");
    d = d.replace(/const theme = useTheme\(\);/g, "const theme = useTheme();\n  const { t } = useTranslation();");
    fs.writeFileSync(f, d);
    console.log('Updated imports in', f);
  }
});
