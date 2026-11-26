import { Share } from 'react-native';
import { getTranslation } from '@/utils/i18n';

export const inviteFriendsToConcert = async (concert: {
  bandName?: string;
  title?: string;
  date?: string;
  startTime?: string;
  location?: string;
  web?: string;
}) => {
  try {
    const bName = concert.bandName || 'Kapela';
    const title = concert.title || 'Koncert';
    const date = concert.date || '';
    const time = concert.startTime ? ` v ${concert.startTime}` : '';
    const location = concert.location ? `\n📍 Místo: ${concert.location}` : '';
    const web = concert.web ? `\n🌐 Odkaz: ${concert.web}` : '';

    const messageTpl = getTranslation('share.inviteMessage') || `🎸 Ahoj! Zvu tě na koncert kapely {bandName}!\n\n🔥 {title}\n📅 Kdy: {date}{time}{location}{web}\n\nPojďme se společně pobavit! 🚀`;

    const message = messageTpl
      .replace('{bandName}', bName)
      .replace('{title}', title)
      .replace('{date}', date)
      .replace('{time}', time)
      .replace('{location}', location)
      .replace('{web}', web);

    const titleTpl = getTranslation('share.inviteTitle') || `Pozvánka na koncert: {title}`;
    const shareTitle = titleTpl.replace('{title}', title);

    await Share.share({
      message,
      title: shareTitle,
    });
  } catch (error: any) {
    console.error('Chyba při sdílení pozvánky:', error);
  }
};
