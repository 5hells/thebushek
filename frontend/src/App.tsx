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
  const popupScaleRef = useRef(0);
  const [time, setTime] = useState<Date>(new Date());
  const [currentPeriod, setCurrentPeriod] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'time' | 'date'>('time');
  const [displayOpacity, setDisplayOpacity] = useState(1);

  const [timeDisplayOpacity, setTimeDisplayOpacity] = useState(1);

  const [periods, setPeriods] = useState<Period[]>([]);

  const [upcomingPeriods, setUpcomingPeriods] = useState<Period[]>([]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now);

      // Calculate popup scale for time display fading
      const cycleDuration = 20000; // 12 seconds
      const scaleUpDuration = 1000; // 1 second
      const visibleDuration = 10000; // 5 seconds
      const scaleDownDuration = 1000; // 1 second
      const cycleTime = now.getTime() % cycleDuration;
      
      let popupScale = 0;
      if (cycleTime < scaleUpDuration) {
        // Scale up phase - expoOut
        const t = cycleTime / scaleUpDuration;
        popupScale = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      } else if (cycleTime < scaleUpDuration + visibleDuration) {
        // Stay visible
        popupScale = 1;
      } else if (cycleTime < scaleUpDuration + visibleDuration + scaleDownDuration) {
        // Scale down phase - expoOut
        const t = (cycleTime - scaleUpDuration - visibleDuration) / scaleDownDuration;
        popupScale = 1 - (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
      }
      setTimeDisplayOpacity(1 - popupScale * 0.5);

      popupScaleRef.current = popupScale;

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

      const upcoming = periods.filter(period => {
        try {
          const periodStart = typeof period.start === 'string' ? new Date(period.start) : new Date(period.start);
          return periodStart > now;
        } catch {
          return false;
        }
      }).slice(0, 3);
      setUpcomingPeriods(upcoming);

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

        // Popup animation
        const popupScale = popupScaleRef.current;

        // Sectograph animation based on popup
        const sectoScale = 1 - popupScale * 0.3;
        const sectoOffsetY = -popupScale * 50;

        ctx.save(); // Outer save for sectograph scaling
        ctx.translate(centerX, centerY + sectoOffsetY);
        ctx.scale(sectoScale, sectoScale);
        ctx.translate(-centerX, -(centerY + sectoOffsetY));

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

        ctx.restore(); // Outer restore for sectograph scaling

        if (popupScale > 0.01 && upcomingPeriods.length > 0) {
          console.log('Drawing popup with scale', popupScale, 'upcoming', upcomingPeriods.length);
          const popupX = centerX;
          // Position popup below the moved and scaled sectograph
          const scaledRadius = outerRadius * sectoScale;
          const popupY = (centerY + sectoOffsetY) + scaledRadius + 50;
          const popupWidth = 300;
          const popupHeight = 50 + upcomingPeriods.length * 35; // Increased spacing for better layout

          ctx.save();
          ctx.translate(popupX, popupY);
          ctx.scale(popupScale, popupScale);

          // Draw rounded rectangle background
          ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
          ctx.beginPath();
          const radius = 10;
          ctx.moveTo(-popupWidth / 2 + radius, -popupHeight / 2);
          ctx.lineTo(popupWidth / 2 - radius, -popupHeight / 2);
          ctx.quadraticCurveTo(popupWidth / 2, -popupHeight / 2, popupWidth / 2, -popupHeight / 2 + radius);
          ctx.lineTo(popupWidth / 2, popupHeight / 2 - radius);
          ctx.quadraticCurveTo(popupWidth / 2, popupHeight / 2, popupWidth / 2 - radius, popupHeight / 2);
          ctx.lineTo(-popupWidth / 2 + radius, popupHeight / 2);
          ctx.quadraticCurveTo(-popupWidth / 2, popupHeight / 2, -popupWidth / 2, popupHeight / 2 - radius);
          ctx.lineTo(-popupWidth / 2, -popupHeight / 2 + radius);
          ctx.quadraticCurveTo(-popupWidth / 2, -popupHeight / 2, -popupWidth / 2 + radius, -popupHeight / 2);
          ctx.closePath();
          ctx.fill();

          // Draw border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Draw text and icons
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          let currentY = -popupHeight / 2 + 25; // Start from top with padding

          for (const p of upcomingPeriods) {
            // Draw colored circle icon
            ctx.fillStyle = p.color || '#666';
            ctx.beginPath();
            ctx.arc(-popupWidth / 2 + 20, currentY, 8, 0, 2 * Math.PI);
            ctx.fill();

            // Draw period name
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(p.label, -popupWidth / 2 + 35, currentY);

            // Draw time
            const startTime = new Date(p.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const endTime = new Date(p.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            ctx.font = '14px sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(`${startTime} - ${endTime}`, -popupWidth / 2 + 35, currentY + 15);

            currentY += 35; // Space for next period
          }

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
  }, [time, periods, upcomingPeriods]);

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
      <div style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        fontSize: '2em',
        opacity: popupScaleRef.current > 0 ? 1 : 0,
        transition: 'opacity 0.5s',
        pointerEvents: 'none',
        textAlign: 'center',
        textShadow: '0 0 5px rgba(0,0,0,0.7)',
      }}>
        It is <b>{time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b>
        <br />
        <span style={{
          fontSize: "0.8em !important",
          fontWeight: 'normal',
          color: 'white',
          animation: 'none',
        }}>{(() => {
          if (!currentPeriod) return <></>;
          const periodObj = periods.find(p => p.label === currentPeriod);
          if (!periodObj) return <></>;
          const periodStart = new Date(periodObj.start);
          const periodEnd = new Date(periodObj.end);
          const totalPeriodMs = periodEnd.getTime() - periodStart.getTime();
          const elapsedMs = time.getTime() - periodStart.getTime();
          const percent = Math.min(100, Math.max(0, Math.floor((elapsedMs / totalPeriodMs) * 100)));
          return (
            <>
              {percent}%
              <progress value={percent} max="100" style={{
                width: '200px',
                height: '10px',
                verticalAlign: 'middle',
                marginLeft: '10px',
              }} className={styles.periodProgress}></progress>
            </>
          );
        })()}</span>
      </div>
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
      <h1 className={styles.time} style={{ opacity: popupScaleRef.current > 0 ? '0' : 1, transition: 'opacity 0.5s' }}>
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
