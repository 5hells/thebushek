import { useEffect, useState, useRef } from 'react'
import styles from './App.module.css';
import './App.css'

interface Period {
  start: number;
  end: number;
  label: string;
  color?: string;
}

function rainbowPastelRandom(seed?: string) {
  let hue: number;
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }
    hue = Math.abs(hash) % 360;
  } else {
    hue = Math.floor(Math.random() * 360);
  }
  return `hsl(${hue}, 70%, 50%)`;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const scalesRef = useRef<{ [key: string]: number }>({});
  const [time, setTime] = useState<Date>(new Date());
  const [currentPeriod, setCurrentPeriod] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'time' | 'date'>('time');
  const [displayOpacity, setDisplayOpacity] = useState(1);

  const [periods, setPeriods] = useState<Period[]>([]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now);

      const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      const activePeriod = periods.find(period => {
        try {
          const periodStart = typeof period.start === 'string' ? new Date(period.start) : new Date(period.start);
          const periodEnd = typeof period.end === 'string' ? new Date(period.end) : new Date(period.end);
          const startMinutes = periodStart.getHours() * 60 + periodStart.getMinutes();
          const endMinutes = periodEnd.getHours() * 60 + periodEnd.getMinutes();
          return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } catch {
          return false;
        }
      });
      setCurrentPeriod(activePeriod?.label || '');

      animationRef.current = requestAnimationFrame(updateTime);
    };

    updateTime();

    const scheduleInterval = setInterval(() => {
      const hours = new Date().getHours();
      const minutes = new Date().getMinutes();
      if ((hours === 0 || hours === 12) && minutes === 0) {
        loadSchedule();
      }
    }, 60000);

    loadSchedule();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      clearInterval(scheduleInterval);
    };
  }, [periods]);

  useEffect(() => {
    const toggleInterval = setInterval(() => {
      setDisplayOpacity(0);
      setTimeout(() => {
        setDisplayMode(prev => prev === 'time' ? 'date' : 'time');
        setDisplayOpacity(1);
      }, 500);
    }, 5000);

    return () => clearInterval(toggleInterval);
  }, []);

  const loadSchedule = async () => {
    try {
      console.log('Loading schedule...');
      const response = await fetch('/schedule.json');
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Loaded schedule data:', data);

      const colorMap: { [key: string]: string } = {};

      const processedPeriods = data.periods.map((period: any) => {
        const periodName = period.name || period.label || 'Unknown';
        if (!colorMap[periodName]) {
          colorMap[periodName] = rainbowPastelRandom(periodName);
        }
        return {
          start: period.start,
          end: period.end,
          label: periodName,
          color: colorMap[periodName]
        };
      });

      const periodsChanged = JSON.stringify(processedPeriods) !== JSON.stringify(periods);
      if (periodsChanged) {
        setPeriods(processedPeriods);
        console.log('Updated periods with stable colors');
      } else {
        console.log('Periods unchanged, skipping update');
      }
    } catch (error) {
      console.error('Failed to load schedule:', error);
      setPeriods([]);
    }
  };

  useEffect(() => {
    let lastDrawTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const draw = (currentTime: number) => {
      if (currentTime - lastDrawTime >= frameInterval) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr + 50;
        canvas.height = rect.height * dpr + 50;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const centerX = width / 2 + 25;
        const centerY = height / 2 + 25;
        const outerRadius = Math.min(width, height) * 0.5;
        const innerRadius = outerRadius * 0.75;

        const scheduleStartMinutes = 8 * 60;
        const scheduleEndMinutes = 14 * 60 + 30;
        const scheduleTotalMinutes = scheduleEndMinutes - scheduleStartMinutes;

        const currentMinutes = time.getHours() * 60 + time.getMinutes() + time.getSeconds() / 60;
        let pointerRotation = 0;

        if (currentMinutes >= scheduleStartMinutes && currentMinutes <= scheduleEndMinutes) {
          const minutesIntoSchedule = currentMinutes - scheduleStartMinutes;
          pointerRotation = (minutesIntoSchedule / scheduleTotalMinutes) * 2 * Math.PI;
        } else if (currentMinutes < scheduleStartMinutes) {
          pointerRotation = 0;
        } else {
          pointerRotation = 2 * Math.PI;
        }

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-pointerRotation);
        ctx.translate(-centerX, -centerY);

        let maxScaledInner = 0;

        periods.filter(period => period.label && period.label.trim()).forEach((period) => {
          // Update scale with smooth interpolation
          let targetScale = 0.95;
          if (currentPeriod) {
            const currentPeriodObj = periods.find(p => p.label === currentPeriod);
            if (currentPeriodObj) {
              const currentMid = (new Date(currentPeriodObj.start).getTime() + new Date(currentPeriodObj.end).getTime()) / 2;
              const periodMid = (new Date(period.start).getTime() + new Date(period.end).getTime()) / 2;
              const distance = Math.abs(currentMid - periodMid);
              const maxDistance = 120 * 60 * 1000; // 30 minutes in milliseconds
              if (distance <= maxDistance) {
                const scaleDiff = 1.05 - 0.95;
                targetScale = 1.05 - (distance / maxDistance) * scaleDiff;
              }
            }
          }
          const currentScale = scalesRef.current[period.label] ?? targetScale;
          const lerpFactor = 0.08; // Faster smoothing
          const newScale = currentScale + (targetScale - currentScale) * lerpFactor;
          scalesRef.current[period.label] = newScale;

          let periodStart: Date;
          let periodEnd: Date;

          try {
            if (typeof period.start === 'string') {
              periodStart = new Date(period.start);
            } else {
              periodStart = new Date(period.start);
            }

            if (typeof period.end === 'string') {
              periodEnd = new Date(period.end);
            } else {
              periodEnd = new Date(period.end);
            }

            if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
              return;
            }
          } catch (error) {
            return;
          }

          const startMinutes = periodStart.getHours() * 60 + periodStart.getMinutes();
          const endMinutes = periodEnd.getHours() * 60 + periodEnd.getMinutes();

          const clippedStartMinutes = Math.max(startMinutes, scheduleStartMinutes);
          const clippedEndMinutes = Math.min(endMinutes, scheduleEndMinutes);

          if (clippedStartMinutes >= clippedEndMinutes) return;

          const startAngle = ((clippedStartMinutes - scheduleStartMinutes) / scheduleTotalMinutes) * 2 * Math.PI - Math.PI / 2;
          const endAngle = ((clippedEndMinutes - scheduleStartMinutes) / scheduleTotalMinutes) * 2 * Math.PI - Math.PI / 2;
          const angleDiff = endAngle - startAngle;
          const midAngle = (startAngle + endAngle) / 2;

          const highlightAlpha = period.label === currentPeriod ? 1.0 : 0.3;

          // Calculate scaled radii for thickness effect
          const scaledOuterRadius = outerRadius * newScale;
          const scaledInnerRadius = innerRadius * (2 - newScale);
          maxScaledInner = Math.max(maxScaledInner, scaledInnerRadius);

          ctx.save();
          ctx.globalAlpha = highlightAlpha;
          ctx.fillStyle = period.color!;

          const outerStartX = centerX + scaledOuterRadius * Math.cos(startAngle);
          const outerStartY = centerY + scaledOuterRadius * Math.sin(startAngle);
          const outerEndX = centerX + scaledOuterRadius * Math.cos(endAngle);
          const outerEndY = centerY + scaledOuterRadius * Math.sin(endAngle);
          const innerEndX = centerX + scaledInnerRadius * Math.cos(endAngle);
          const innerEndY = centerY + scaledInnerRadius * Math.sin(endAngle);
          const innerStartX = centerX + scaledInnerRadius * Math.cos(startAngle);
          const innerStartY = centerY + scaledInnerRadius * Math.sin(startAngle);

          ctx.beginPath();
          ctx.moveTo(outerStartX, outerStartY);
          ctx.arc(centerX, centerY, scaledOuterRadius, startAngle, endAngle);
          ctx.quadraticCurveTo(centerX, centerY, innerEndX, innerEndY);
          ctx.arc(centerX, centerY, scaledInnerRadius, endAngle, startAngle, true);
          ctx.quadraticCurveTo(centerX, centerY, outerStartX, outerStartY);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          ctx.globalAlpha = highlightAlpha;
          const textRadius = (scaledOuterRadius + scaledInnerRadius) / 2;
          const textX = centerX + textRadius * Math.cos(midAngle);
          const textY = centerY + textRadius * Math.sin(midAngle);

          const angleProportion = angleDiff / (2 * Math.PI);
          const baseFontSize = Math.max(10, Math.min(32, 12 + angleProportion * 40)) * newScale;

          ctx.save();
          ctx.translate(textX, textY);
          ctx.rotate(midAngle + Math.PI / 2);

          ctx.fillStyle = 'white';
          ctx.font = `bold ${baseFontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 2;
          ctx.fillText(period.label, 0, -baseFontSize * 0.4);

          ctx.font = `${Math.max(8, baseFontSize * 0.6)}px sans-serif`;
          const timeStr = `${periodStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${periodEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
          ctx.fillText(timeStr, 0, baseFontSize * 0.5);

          ctx.restore();
        });

        ctx.globalAlpha = 1;

        ctx.restore();

        ctx.globalCompositeOperation = "destination-out";

        ctx.beginPath();
        ctx.arc(centerX, centerY, maxScaledInner * 0.95, 0, 2 * Math.PI);
        ctx.fill();

        ctx.globalCompositeOperation = "source-over";

        if (currentMinutes >= scheduleStartMinutes && currentMinutes <= scheduleEndMinutes) {
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(0);
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -maxScaledInner * 0.8);
          ctx.lineTo(0, -maxScaledInner * 0.9);
          ctx.stroke();
          ctx.restore();
        }

        lastDrawTime = currentTime;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    const handleResize = () => {
      lastDrawTime = 0;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [time, periods]);

  const formatDateDuration = (durationMs: number) => {
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
  }

  return (
    <div className={styles.container}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '80vmin',
          height: '80vmin',
          maxWidth: '80vh',
          maxHeight: '80vh',
        }}
      />
      <h1 className={styles.time} style={{ opacity: displayOpacity, transition: 'opacity 0.5s' }}>
        {displayMode === 'time' ? (
          <>
            {time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            <br />
            <small style={{ fontSize: '0.6em', opacity: 0.7 }}>{new Date().setHours(14, 30, 0, 0) > time.getTime() ? 'Time until end of school' : 'Time since end of school'}: {formatDateDuration(Math.abs(time.getTime() - new Date().setHours(14, 30, 0, 0)))}</small>
            {currentPeriod && (
              <>
                <br />
                <span style={{
                  fontSize: '1.2em',
                  fontWeight: 'bold',
                  color: 'white',
                  animation: 'pulse 2s infinite'
                }}>
                  {currentPeriod || 'Intermission'}
                </span>
              </>
            )}
          </>
        ) : (
          <>
            {time.toLocaleDateString()}
            <br />
            <span style={{
              fontSize: '1.2em',
              fontWeight: 'bold',
              color: 'white',
              animation: 'pulse 2s infinite'
            }}>
              {currentPeriod || 'Intermission'}
            </span>
          </>
        )}
      </h1>
    </div>
  )
}

export default App
