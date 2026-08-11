/**
 * Simple schedule to human readable string converter
 */
export const getScheduleSummary = (data, t) => {
  if (!data) return t('workflow.designer.notSet', 'Not Set');
  
  const { scheduleMode, cron, intervalValue, intervalUnit, specificTime } = data;

  if (scheduleMode === 'interval') {
    const unitMap = {
      seconds: t('common.seconds', 'seconds'),
      minutes: t('common.minutes', 'minutes'),
      hours: t('common.hours', 'hours'),
    };
    return `${t('workflow.designer.every', 'Every')} ${intervalValue} ${unitMap[intervalUnit] || intervalUnit}`;
  }

  if (scheduleMode === 'once' && specificTime) {
    const date = new Date(specificTime);
    return `${t('workflow.designer.at', 'At')} ${date.toLocaleString()}`;
  }

  if (!cron) return t('workflow.designer.notSet', 'Not Set');
  
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [min, hour, day, month, dow] = parts;
  const timeStr = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;

  // Daily: 0 9 * * *
  if (day === '*' && month === '*' && dow === '*') {
    return `${t('workflow.designer.daily', 'Daily')} ${timeStr}`;
  }

  // Weekly: 0 9 * * 1
  if (dow !== '*' && day === '*' && month === '*') {
    const days = {
      '0': t('common.sunday', 'Sunday'),
      '1': t('common.monday', 'Monday'),
      '2': t('common.tuesday', 'Tuesday'),
      '3': t('common.wednesday', 'Wednesday'),
      '4': t('common.thursday', 'Thursday'),
      '5': t('common.friday', 'Friday'),
      '6': t('common.saturday', 'Saturday'),
    };
    return `${t('workflow.designer.weekly', 'Weekly')} (${days[dow]}) ${timeStr}`;
  }

  // Monthly: 0 9 1 * *
  if (day !== '*' && month === '*' && dow === '*') {
    return `${t('workflow.designer.monthly', 'Monthly')} (${day}${t('common.day', 'th')}) ${timeStr}`;
  }

  return cron;
};

