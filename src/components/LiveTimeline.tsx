"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, AlertCircle, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { getAllServiceOrders } from '@/lib/serviceOrderStorage';
import { parse, format, differenceInDays, addDays, startOfDay, isBefore, isAfter, differenceInMinutes, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OrderTimeline {
  orderId: string;
  orderName: string;
  file: string;
  groupName: string;
  startDate: Date;
  endDate: Date;
  color: string;
  status: 'upcoming' | 'active' | 'completed';
  totalDays: number;
  serviceDates: Set<number>; // Timestamps of days with services
}

// Paleta de colores pastel
const pastelColors = [
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
  '#E0BBE4', '#D4A5A5', '#FFDAC1', '#C7CEEA', '#B5EAD7',
  '#FFE5B4', '#E6E6FA', '#FADADD', '#DDA0DD', '#F0E68C',
];

function getColorForOrder(orderId: string): string {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = orderId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return pastelColors[Math.abs(hash) % pastelColors.length];
}

export function LiveTimeline() {
  const [orderTimelines, setOrderTimelines] = useState<OrderTimeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [centerDate, setCenterDate] = useState(startOfDay(new Date())); // Date to center the timeline on
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [timelineRange, setTimelineRange] = useState<{ start: Date; end: Date; days: Date[] }>({
    start: new Date(),
    end: new Date(),
    days: [],
  });
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Load all orders once
  useEffect(() => {
    const fetchOrderTimelines = async () => {
      setIsLoading(true);
      try {
        const allOrders = await getAllServiceOrders();
        const activeOrders = allOrders.filter(
          order => order.status !== 'eliminado' && order.status !== 'cancelado'
        );

        const timelines: OrderTimeline[] = [];

        activeOrders.forEach(order => {
          if (!order.data || !order.data.services || !Array.isArray(order.data.services)) {
            return;
          }

          const dates: Date[] = [];
          const serviceDatesSet = new Set<number>(); // Store timestamps of days with services

          order.data.services.forEach(service => {
            try {
              if (!service || !service.fecha) return;
              const serviceDate = parse(service.fecha, 'dd/MM/yyyy', new Date());
              if (!isNaN(serviceDate.getTime())) {
                const normalizedDate = startOfDay(serviceDate);
                dates.push(normalizedDate);
                serviceDatesSet.add(normalizedDate.getTime()); // Store timestamp
              }
            } catch (error) {
              console.error('Error parsing service date:', error);
            }
          });

          if (dates.length === 0) return;

          dates.sort((a, b) => a.getTime() - b.getTime());
          const startDate = dates[0];
          const endDate = dates[dates.length - 1];

          const totalDays = differenceInDays(endDate, startDate) + 1;

          const today = startOfDay(new Date());
          let status: 'upcoming' | 'active' | 'completed';
          if (isBefore(endDate, today)) {
            status = 'completed';
          } else if (isAfter(startDate, today)) {
            status = 'upcoming';
          } else {
            status = 'active';
          }

          timelines.push({
            orderId: order.id,
            orderName: order.orderName,
            file: order.data.file || 'N/A',
            groupName: order.data.ref || order.data.hotel || 'Sin nombre',
            startDate,
            endDate,
            color: getColorForOrder(order.id),
            status,
            totalDays,
            serviceDates: serviceDatesSet, // Include the set of service dates
          });
        });

        // Filter out split orders - keep only parent orders or the longest duration one
        const filteredTimelines: OrderTimeline[] = [];
        const processedFiles = new Set<string>();

        // Group timelines by file number
        const timelinesByFile = new Map<string, OrderTimeline[]>();
        timelines.forEach(timeline => {
          const file = timeline.file;
          if (!timelinesByFile.has(file)) {
            timelinesByFile.set(file, []);
          }
          timelinesByFile.get(file)!.push(timeline);
        });

        // For each file, keep only the order with the longest duration
        timelinesByFile.forEach((ordersForFile, file) => {
          if (ordersForFile.length === 1) {
            filteredTimelines.push(ordersForFile[0]);
          } else {
            // Multiple orders for the same file - keep the one with longest duration
            const longestOrder = ordersForFile.reduce((longest, current) => {
              return current.totalDays > longest.totalDays ? current : longest;
            });
            filteredTimelines.push(longestOrder);
          }
        });

        // Sort: Most recent at the top, older at the bottom (descending staircase to the right)
        // This creates a visual "staircase" effect going up and to the right
        filteredTimelines.sort((a, b) => {
          // Sort by start date: newest first (descending)
          return b.startDate.getTime() - a.startDate.getTime();
        });

        setOrderTimelines(filteredTimelines);
      } catch (error) {
        console.error('Error fetching order timelines:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderTimelines();
    const refreshInterval = setInterval(fetchOrderTimelines, 5 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [isFullscreen]); // Only re-fetch when fullscreen changes or on mount

  // Update timeline range when centerDate changes (no data reload)
  useEffect(() => {
    if (orderTimelines.length === 0) return;

    // Calculate timeline range based on centerDate
    const daysBeforeAfter = isFullscreen ? 7 : 5;
    const rangeStart = addDays(centerDate, -daysBeforeAfter);
    const rangeEnd = addDays(centerDate, daysBeforeAfter);

    const days: Date[] = [];
    let currentDay = rangeStart;
    while (currentDay <= rangeEnd) {
      days.push(currentDay);
      currentDay = addDays(currentDay, 1);
    }

    setTimelineRange({ start: rangeStart, end: rangeEnd, days });
  }, [centerDate, orderTimelines, isFullscreen]);

  // Scroll to the first order that starts on the given date
  const scrollToFirstOrderOnDate = (targetDate: Date) => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (!scrollContainer) return;

      // Find the first order that starts on or after the target date
      const ordersStartingOnOrAfterDate = orderTimelines
        .map((timeline, index) => ({ timeline, index }))
        .filter(({ timeline }) => !isBefore(timeline.startDate, targetDate))
        .sort((a, b) => a.timeline.startDate.getTime() - b.timeline.startDate.getTime());

      if (ordersStartingOnOrAfterDate.length > 0) {
        // Calculate the position: each order row is h-14 (56px) + mb-2 (8px) = 64px total
        const rowHeight = 64; // Total height including margin
        const targetIndex = ordersStartingOnOrAfterDate[0].index;
        // Start counting from mt-4 (16px) after the header, no additional offset needed
        const scrollPosition = 16 + (targetIndex * rowHeight);

        scrollContainer.scrollTo({ top: scrollPosition, behavior: 'smooth' });
      } else {
        // If no orders start on or after the target date, scroll to top
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  // Navigation functions - scroll horizontally by shifting the center date
  const goToPreviousDay = () => {
    setIsTransitioning(true);
    const newDate = addDays(centerDate, -1);
    setCenterDate(newDate);
    setTimeout(() => {
      setIsTransitioning(false);
      scrollToFirstOrderOnDate(newDate);
    }, 300);
  };

  const goToNextDay = () => {
    setIsTransitioning(true);
    const newDate = addDays(centerDate, 1);
    setCenterDate(newDate);
    setTimeout(() => {
      setIsTransitioning(false);
      scrollToFirstOrderOnDate(newDate);
    }, 300);
  };

  const goToToday = () => {
    setIsTransitioning(true);
    const today = startOfDay(new Date());
    setCenterDate(today);
    setTimeout(() => {
      setIsTransitioning(false);
      scrollToFirstOrderOnDate(today);
    }, 300);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Calendar className="text-primary animate-pulse" />
            Timeline en Vivo <Badge variant="outline" className="ml-2">BETA</Badge>
          </CardTitle>
          <CardDescription>Vista en tiempo real de órdenes de servicio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <Calendar className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (orderTimelines.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Calendar className="text-primary" />
            Timeline en Vivo <Badge variant="outline" className="ml-2">BETA</Badge>
          </CardTitle>
          <CardDescription>Vista en tiempo real de órdenes de servicio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>No hay órdenes activas en el rango visible (±2 días)</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const today = startOfDay(new Date());
  const totalDays = timelineRange.days.length;

  // Calculate position of the red line (current time)
  const minutesSinceRangeStart = differenceInMinutes(currentTime, timelineRange.start);
  const totalMinutesInRange = differenceInMinutes(timelineRange.end, timelineRange.start) + 24 * 60;
  const redLinePosition = (minutesSinceRangeStart / totalMinutesInRange) * 100;

  const isCenterToday = isSameDay(centerDate, startOfDay(new Date()));

  return (
    <Card className={`shadow-lg transition-all duration-300 ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Calendar className="text-primary" />
              Timeline en Vivo <Badge variant="outline" className="ml-2">BETA</Badge>
            </CardTitle>
            <CardDescription>
              {orderTimelines.length} órdenes activas • Actualizado: {format(currentTime, 'HH:mm', { locale: es })}
            </CardDescription>
          </div>

          {/* Navigation controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousDay}
                title="Día anterior"
                className="transition-all hover:scale-105"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                onClick={goToToday}
                className="min-w-[140px]"
                disabled={isCenterToday}
              >
                {isCenterToday ? "Hoy" : `Ir a Hoy (${format(startOfDay(new Date()), 'dd MMM', { locale: es })})`}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={goToNextDay}
                title="Día siguiente"
                className="transition-all hover:scale-105"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                className="transition-all hover:scale-105"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              <div className="flex items-center gap-2 text-xs">
                <Badge className="bg-green-500">En Curso</Badge>
                <Badge className="bg-blue-500">Próximo</Badge>
                <Badge variant="secondary">Completado</Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea ref={scrollAreaRef} className={`transition-all duration-300 ${isFullscreen ? 'h-[calc(100vh-12rem)]' : 'h-[450px]'}`}>
          <div className={`relative transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
            {/* Header con días */}
            <div className="sticky top-0 bg-background z-20 pb-3 border-b-2">
              <div className="flex text-sm font-medium">
                {timelineRange.days.map((day, index) => {
                  const isToday = day.getTime() === today.getTime();
                  const isCenterDay = day.getTime() === centerDate.getTime();
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                  return (
                    <div
                      key={index}
                      className={`flex-1 text-center py-2 border-r border-dashed border-gray-300/40 transition-all duration-300 ${
                        isCenterDay ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500 border-2 border-solid shadow-sm' : ''
                      } ${isToday && !isCenterDay ? 'bg-primary/10 font-bold text-primary' : ''
                      } ${isWeekend && !isCenterDay ? 'bg-muted/20' : ''}`}
                    >
                      <div className={`text-base ${isCenterDay ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
                        {format(day, 'dd', { locale: es })}
                      </div>
                      <div className={`text-xs ${isCenterDay ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-muted-foreground'}`}>
                        {format(day, 'EEE', { locale: es })}
                      </div>
                      <div className={`text-xs ${isCenterDay ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                        {format(day, 'MMM', { locale: es })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline container */}
            <div className="relative mt-4 space-y-3">
              {/* Red line indicating current time */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 shadow-lg pointer-events-none"
                style={{ left: `${redLinePosition}%` }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-md z-40">
                  {format(currentTime, 'HH:mm', { locale: es })}
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full shadow-md animate-pulse z-40" />
              </div>

              {/* Background grid */}
              <div className="absolute inset-0 flex pointer-events-none">
                {timelineRange.days.map((day, index) => {
                  const isToday = day.getTime() === today.getTime();
                  const isCenterDay = day.getTime() === centerDate.getTime();
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                  return (
                    <div
                      key={index}
                      className={`flex-1 border-r border-dashed border-gray-300/30 transition-all duration-300 ${
                        isCenterDay ? 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-400 border-solid' : ''
                      } ${isWeekend && !isCenterDay ? 'bg-muted/10' : ''
                      } ${isToday && !isCenterDay ? 'bg-primary/5' : ''}`}
                    />
                  );
                })}
              </div>

              {/* Timeline bars */}
              {orderTimelines.map((timeline) => {
                // Only show orders that have at least part of their duration in the visible range
                const rangeStart = timelineRange.start;
                const rangeEnd = timelineRange.end;

                // Check if order ends before range starts or starts after range ends
                if (isBefore(timeline.endDate, rangeStart) || isAfter(timeline.startDate, rangeEnd)) {
                  return null; // Skip this order
                }

                // Build segments for this order (solid bars for days with services, dotted lines for gaps)
                const segments: Array<{
                  type: 'solid' | 'dotted';
                  startIndex: number;
                  endIndex: number;
                }> = [];

                let currentSegmentStart: number | null = null;
                let currentSegmentType: 'solid' | 'dotted' | null = null;

                // Iterate through all days from order start to end
                let checkDate = new Date(timeline.startDate);
                let dayIndex = 0;

                while (checkDate <= timeline.endDate) {
                  const hasService = timeline.serviceDates.has(checkDate.getTime());
                  const segmentType: 'solid' | 'dotted' = hasService ? 'solid' : 'dotted';

                  // Start a new segment or continue the current one
                  if (currentSegmentType === null || currentSegmentType !== segmentType) {
                    // Finish the previous segment
                    if (currentSegmentType !== null && currentSegmentStart !== null) {
                      segments.push({
                        type: currentSegmentType,
                        startIndex: currentSegmentStart,
                        endIndex: dayIndex - 1,
                      });
                    }
                    // Start a new segment
                    currentSegmentStart = dayIndex;
                    currentSegmentType = segmentType;
                  }

                  checkDate = addDays(checkDate, 1);
                  dayIndex++;
                }

                // Close the last segment
                if (currentSegmentType !== null && currentSegmentStart !== null) {
                  segments.push({
                    type: currentSegmentType,
                    startIndex: currentSegmentStart,
                    endIndex: dayIndex - 1,
                  });
                }

                // Find the first solid segment to display the label
                const firstSolidSegmentIndex = segments.findIndex(seg => seg.type === 'solid');

                // Calculate the rightmost position for the badge
                let rightmostPosition = 0;

                return (
                  <div key={timeline.orderId} className="relative h-14 mb-2 group">
                    {/* Render each segment */}
                    {segments.map((segment, segmentIndex) => {
                      // Map segment indices (relative to order) to timeline day indices (visible range)
                      const segmentStartDate = addDays(timeline.startDate, segment.startIndex);
                      const segmentEndDate = addDays(timeline.startDate, segment.endIndex);

                      // Find indices in visible timeline
                      const visibleStartIndex = timelineRange.days.findIndex(
                        day => day.getTime() === segmentStartDate.getTime()
                      );
                      const visibleEndIndex = timelineRange.days.findIndex(
                        day => day.getTime() === segmentEndDate.getTime()
                      );

                      // Skip segments completely outside visible range
                      if (
                        (visibleStartIndex === -1 && isBefore(segmentEndDate, rangeStart)) ||
                        (visibleEndIndex === -1 && isAfter(segmentStartDate, rangeEnd))
                      ) {
                        return null;
                      }

                      // Clamp to visible range
                      let adjustedStartIndex = visibleStartIndex !== -1 ? visibleStartIndex : 0;
                      let adjustedEndIndex = visibleEndIndex !== -1 ? visibleEndIndex : totalDays - 1;

                      const left = (adjustedStartIndex / totalDays) * 100;
                      const width = ((adjustedEndIndex - adjustedStartIndex + 1) / totalDays) * 100;

                      // Track the rightmost position
                      const segmentEnd = left + width;
                      if (segmentEnd > rightmostPosition) {
                        rightmostPosition = segmentEnd;
                      }

                      if (segment.type === 'solid') {
                        // Solid bar for days with services
                        return (
                          <div
                            key={segmentIndex}
                            className="absolute top-1/2 -translate-y-1/2 h-12 rounded-lg shadow-md cursor-pointer transition-all group-hover:shadow-xl group-hover:scale-105 flex items-center px-3"
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              backgroundColor: timeline.color,
                              minWidth: '60px',
                            }}
                            title={`${timeline.file} - ${timeline.groupName}\n${format(segmentStartDate, 'dd/MM/yyyy', { locale: es })} - ${format(segmentEndDate, 'dd/MM/yyyy', { locale: es })}`}
                          >
                            {/* Show file and group name only on the first solid segment */}
                            {segmentIndex === firstSolidSegmentIndex && (
                              <div className="flex flex-col justify-center flex-1 min-w-0">
                                <div className="font-bold text-sm text-gray-800 truncate">
                                  {timeline.file}
                                </div>
                                <div className="text-xs text-gray-700 truncate">
                                  {timeline.groupName}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        // Dotted line for days without services
                        return (
                          <div
                            key={segmentIndex}
                            className="absolute top-1/2 -translate-y-1/2 h-1 cursor-pointer transition-all"
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              borderTop: `3px dashed ${timeline.color}`,
                              opacity: 0.6,
                            }}
                            title={`${timeline.file} - Sin servicios\n${format(segmentStartDate, 'dd/MM/yyyy', { locale: es })} - ${format(segmentEndDate, 'dd/MM/yyyy', { locale: es })}`}
                          />
                        );
                      }
                    })}

                    {/* Status badge on hover - positioned at the end of the rightmost segment */}
                    <div
                      className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity z-40"
                      style={{ left: `calc(${rightmostPosition}% - 70px)` }}
                    >
                      {timeline.status === 'active' && <Badge className="bg-green-500 shadow-md">En Curso</Badge>}
                      {timeline.status === 'upcoming' && <Badge className="bg-blue-500 shadow-md">Próximo</Badge>}
                      {timeline.status === 'completed' && <Badge variant="secondary" className="shadow-md">Completado</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
