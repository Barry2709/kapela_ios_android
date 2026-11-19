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
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 12,
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'kapelaiosandroid://' }}
    >
      {/* Hlavička kapely */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 'match_parent',
        }}
      >
        <TextWidget
          text={bandName}
          style={{
            fontSize: 12,
            color: '#2196f3',
            fontWeight: 'bold',
          }}
        />
        <TextWidget
          text="Kapela"
          style={{
            fontSize: 10,
            color: '#8e8e93',
          }}
        />
      </FlexWidget>

      {/* Název koncertu a Místo */}
      <FlexWidget style={{ width: 'match_parent', marginTop: 4 }}>
        <TextWidget
          text={concertTitle}
          style={{
            fontSize: 15,
            color: '#ffffff',
            fontWeight: 'bold',
          }}
        />
        {locationStr ? (
          <TextWidget
            text={`Místo: ${locationStr}`}
            style={{
              fontSize: 11,
              color: '#aaaaaa',
              marginTop: 2,
            }}
          />
        ) : null}
      </FlexWidget>

      {/* Datum a Čas */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#33ff9800',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 4,
          width: 'match_parent',
          marginTop: 6,
        }}
      >
        <TextWidget
          text={`Datum: ${dateStr}${timeStr ? ' v ' + timeStr : ''}`}
          style={{
            fontSize: 12,
            color: '#ff9800',
            fontWeight: 'bold',
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
