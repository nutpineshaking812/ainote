import { v4 as uuidv4 } from 'uuid';
import {
  MSG_INIT,
  MSG_INIT_SUCCESS,
  MSG_INIT_ERROR,
  MSG_SUCCESS,
  MSG_EXEC,
  MSG_QUERY,
} from './messageTypes';

// @ts-ignore
import workerUrl from './LocalDatabaseWorker?worker&url';

/**
 * LocalDatabaseManager - Unified Database Access
 *
 * Singleton manager for SQLite database access.
 * Provides both raw SQL interface and business operation routing.
 */
export class LocalDatabaseManager {
  private static instance: LocalDatabaseManager;
  private worker: Worker | null = null;
  private pendingRequests: Map<
    string,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  > = new Map();
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): LocalDatabaseManager {
    if (!LocalDatabaseManager.instance) {
      LocalDatabaseManager.instance = new LocalDatabaseManager();
    }
    return LocalDatabaseManager.instance;
  }

  /**
   * Initialize the database worker
   */
  public async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      try {
        // If we're re-initializing, clean up the old worker first
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }

        const absoluteWorkerUrl = new URL(workerUrl, window.location.origin).href;

        // Force the worker script to be loaded from the same origin as the document (overseas server)
        // to bypass the browser's cross-origin module Web Worker and CORS restrictions entirely.
        const sameOriginWorkerUrl = new URL(new URL(absoluteWorkerUrl).pathname, window.location.origin).href;

        console.log('[LocalDB] Manager initialize: start', {
          workerUrl,
          absoluteWorkerUrl,
          sameOriginWorkerUrl,
          origin: window.location.origin
        });

        this.worker = new Worker(sameOriginWorkerUrl, {
          type: 'module',
        });

        this.worker.onmessage = (event) => {
          const { type, id, results, data, error } = event.data;
          console.log('[LocalDB] Manager received message:', event.data);

          if (type === MSG_INIT_SUCCESS) {
            this.isInitialized = true;
            console.log('[LocalDB] Manager initialized successfully');
            resolve();
            return;
          }

          if (type === MSG_INIT_ERROR) {
            console.error('[LocalDB] Initialization error:', error);
            // Clear promise on failure to allow retry
            this.initPromise = null;
            reject(new Error(error));
            return;
          }

          const request = this.pendingRequests.get(id);
          if (request) {
            if (type === MSG_SUCCESS) {
              // Support both 'results' (SQL queries) and 'data' (business operations)
              request.resolve(data !== undefined ? data : results);
            } else {
              request.reject(new Error(error));
            }
            this.pendingRequests.delete(id);
          }
        };

        this.worker.onerror = (error) => {
          console.error('[LocalDB] Worker error:', error);
          this.initPromise = null;
          reject(error);
        };

        this.worker.postMessage({ type: MSG_INIT });
      } catch (error) {
        this.initPromise = null;
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * Execute SQL statement (no results)
   */
  public async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    const id = uuidv4();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker?.postMessage({ type: MSG_EXEC, id, sql, params });
    });
  }

  /**
   * Execute SQL query (with results)
   */
  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.isInitialized) await this.initialize();

    const id = uuidv4();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker?.postMessage({ type: MSG_QUERY, id, sql, params });
    });
  }

  /**
   * Send custom message to worker (for business operations)
   *
   * @param type Message type (e.g., 'RESOURCES_GET_ALL')
   * @param payload Message payload
   * @returns Promise with operation result
   */
  public async sendMessage(type: string, payload: any = {}): Promise<any> {
    if (!this.isInitialized) await this.initialize();

    const id = uuidv4();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker?.postMessage({ type, id, ...payload });
    });
  }

  /**
   * Get worker instance (for advanced use cases)
   */
  public getWorker(): Worker | null {
    return this.worker;
  }

  /**
   * Check if database is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Terminate the worker and reset state
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
    this.initPromise = null;
    this.pendingRequests.clear();
  }
}

export const localDb = LocalDatabaseManager.getInstance();
