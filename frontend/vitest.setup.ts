// Set up Web API globals for Node environment
Object.assign(global, {
  Request: class Request {
    method: string;
    headers: Map<string, string>;
    url: string;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
    }
  } as any,
  Response: class Response {
    body: any;
    status: number;
    statusText: string;
    headers: Map<string, string>;
    _bodyValue: any;
    constructor(body?: any, init?: any) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || '';
      this.headers = new Map();
      this._bodyValue = body;
    }
    async json() {
      return typeof this._bodyValue === 'string'
        ? JSON.parse(this._bodyValue)
        : this._bodyValue;
    }
    static async json(data: any, init?: any) {
      const response = new (this as any)(JSON.stringify(data), init);
      return response;
    }
  } as any,
  URL: URL,
  URLSearchParams: URLSearchParams,
} as any);
