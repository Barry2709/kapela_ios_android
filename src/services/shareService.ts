import { Share, Alert } from 'react-native';

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

    const message = `🎸 Ahoj! Zvu tě na koncert kapely ${bName}!\n\n🔥 ${title}\n📅 Kdy: ${date}${time}${location}${web}\n\nPojďme se společně pobavit! 🚀`;

    await Share.share({
      message,
      title: `Pozvánka na koncert: ${title}`,
    });
  } catch (error: any) {
    console.error('Chyba při sdílení pozvánky:', error);
  }
};
