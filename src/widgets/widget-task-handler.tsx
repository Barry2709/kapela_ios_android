import React from 'react';
import { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { ConcertWidget } from './ConcertWidget';
import AsyncStorage from '@react-native-async-storage/async-storage';

const nameToWidgetMap = {
  ConcertWidget: ConcertWidget,
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget = nameToWidgetMap[widgetInfo.widgetName as keyof typeof nameToWidgetMap];

  let widgetData = {
    bandName: 'Kapela',
    concertTitle: 'Žádný nadcházející koncert',
    dateStr: 'Čekáme na nový termín',
    timeStr: '',
    locationStr: '',
  };

  try {
    const savedStr = await AsyncStorage.getItem('widgetConcertData');
    if (savedStr) {
      const parsed = JSON.parse(savedStr);
      widgetData = { ...widgetData, ...parsed };
    }
  } catch (e) {}

  props.renderWidget(
    <Widget
      bandName={widgetData.bandName}
      concertTitle={widgetData.concertTitle}
      dateStr={widgetData.dateStr}
      timeStr={widgetData.timeStr}
      locationStr={widgetData.locationStr}
    />
  );
}
