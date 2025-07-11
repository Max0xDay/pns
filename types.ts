export type Context = {
  request: {
    url: URL;
    body: () => { value: unknown };
  };
  response: {
    body: unknown;
    type: string;
  };
  isUpgradable: boolean;
  upgrade: () => WebSocket;
  throw: (code: number) => void;
};

export type Next = () => Promise<void>;
