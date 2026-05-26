export type LogLevel = 'info' | 'warn' | 'error';
export type LogListener = (level: LogLevel, msg: string) => void;

class LoggerClass {
  private listeners: LogListener[] = [];

  addListener(listener: LogListener): void {
    if (!this.listeners.includes(listener)) {
      this.listeners.push(listener);
    }
  }

  removeListener(listener: LogListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  info(msg: string, ...args: any[]): void {
    this.log('info', msg, ...args);
  }

  warn(msg: string, ...args: any[]): void {
    this.log('warn', msg, ...args);
  }

  error(msg: string, ...args: any[]): void {
    this.log('error', msg, ...args);
  }

  private log(level: LogLevel, msg: string, ...args: any[]): void {
    let formattedMsg = msg;
    if (args.length > 0) {
      // Very basic formatting
      formattedMsg += ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    }
    
    // Broadcast log to all registered listeners
    this.listeners.forEach((listener) => {
      try {
        listener(level, formattedMsg);
      } catch (err) {
        // Safe catch to prevent logging loop failures
      }
    });

    // Also fallback print to system console if no listeners are attached
    if (this.listeners.length === 0) {
      const time = new Date().toLocaleTimeString();
      const prefix = `[${time}] [CORE-${level.toUpperCase()}]`;
      if (level === 'error') {
        console.error(`${prefix} ${formattedMsg}`);
      } else if (level === 'warn') {
        console.warn(`${prefix} ${formattedMsg}`);
      } else {
        console.log(`${prefix} ${formattedMsg}`);
      }
    }
  }
}

export const Logger = new LoggerClass();
