import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface ConcertWidgetProps {
  bandName?: string;
  concertTitle?: string;
  dateStr?: string;
  timeStr?: string;
  locationStr?: string;
}

export function ConcertWidget({
  bandName = 'Kapela',
  concertTitle = 'Žádný nadcházející koncert',
  dateStr = 'Čekáme na nový termín',
  timeStr = '',
  locationStr = '',
}: ConcertWidgetProps) {
  const formattedDateTime = timeStr ? `📅 ${dateStr} v ${timeStr}` : `📅 ${dateStr}`;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#1c1c1e',
        borderRadius: 14,
        padding: 10,
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'kapelaiosandroid://' }}
    >
      {/* 1. Horní řádek: Datum a Čas vlevo | Název kapely vpravo */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 'match_parent',
        }}
      >
        <TextWidget
          text={formattedDateTime}
          style={{
            fontSize: 12,
            color: '#ff9800',
            fontWeight: 'bold',
          }}
        />
        <TextWidget
          text={bandName}
          style={{
            fontSize: 12,
            color: '#2196f3',
            fontWeight: 'bold',
          }}
        />
      </FlexWidget>

      {/* 2. Druhý řádek: Název akce zarovnaný vlevo */}
      <FlexWidget style={{ width: 'match_parent', marginTop: 3 }}>
        <TextWidget
          text={concertTitle}
          style={{
            fontSize: 14,
            color: '#ffffff',
            fontWeight: 'bold',
          }}
        />
      </FlexWidget>

      {/* 3. Třetí řádek: Místo zarovnané vlevo */}
      {locationStr ? (
        <FlexWidget style={{ width: 'match_parent', marginTop: 2 }}>
          <TextWidget
            text={`📍 Místo: ${locationStr}`}
            style={{
              fontSize: 11,
              color: '#aaaaaa',
            }}
          />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
